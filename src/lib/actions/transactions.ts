"use server";

import { db, type Tx } from "@/db";
import { getSessionUser } from "@/lib/auth-session";
import {
  transactions,
  transactionSplits,
  contacts,
  accounts,
  profiles,
} from "@/db/schema";
import { eq, and, desc, or, isNull, sql, inArray } from "drizzle-orm";
import { getSignedFlowDelta } from "@/lib/currency";
import { notifyTransactionDeleted } from "@/lib/domain/notifications";
import { z } from "zod";
import { rpcActionWithAuth } from "@/lib/action-helpers";
import type { TransactionWithJoins, TransactionSplit } from "@/types";

// Zod Schemas
const SplitSchema = z.object({
  userId: z.string().nullable().optional(),
  groupMemberId: z.string().nullable().optional(),
  amount: z.number().int(),
  percentage: z.number().nullable().optional(),
  isSettled: z.boolean().optional(),
  memberNameSnapshot: z.string().nullable().optional(),
});

const CreateTransactionSchema = z.object({
  amount: z.number().int(),
  flow: z.enum(["IN", "OUT"]),
  mode: z.enum(["BUSINESS", "PERSONAL"]),
  name: z.string().min(1, "Name is required"),
  note: z.string().nullable().optional(),
  date: z.union([z.date(), z.string()]),
  dueDate: z.union([z.date(), z.string()]).nullable().optional(),
  contactId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  businessId: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  payerId: z.string().nullable().optional(),
  payerGroupMemberId: z.string().nullable().optional(),
  splitType: z.enum(["EQUALLY", "BY_AMOUNT", "BY_PERCENTAGE"]).optional(),
  splits: z.array(SplitSchema).nullable().optional(),
});

const UpdateTransactionSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int(),
  flow: z.enum(["IN", "OUT"]),
  mode: z.enum(["BUSINESS", "PERSONAL"]),
  name: z.string().min(1, "Name is required"),
  note: z.string().nullable().optional(),
  date: z.union([z.date(), z.string()]),
  dueDate: z.union([z.date(), z.string()]).nullable().optional(),
  contactId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
});

const GetTransactionsFiltersSchema = z.object({
  mode: z.enum(["BUSINESS", "PERSONAL"]).optional(),
  contactId: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  limit: z.number().int().positive().optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0),
});

// Helper functions (Db tx scoped)
async function updateAccountBalance(tx: Tx, accountId: string, userId: string, delta: number) {
  if (delta === 0) return;
  const formattedDelta = String(delta);
  await tx
    .update(accounts)
    .set({ balance: sql`${accounts.balance} + ${formattedDelta}` })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
}

async function updateContactStats(
  tx: Tx,
  contactId: string,
  userId: string,
  delta: number,
  countDelta: number,
  transactionDate?: Date
) {
  const updateData: any = {
    netBalance: sql`COALESCE(${contacts.netBalance}, 0) + ${String(delta)}`,
    transactionCount: sql`COALESCE(${contacts.transactionCount}, 0) + ${String(countDelta)}`,
  };
  if (transactionDate) {
    updateData.lastTransactionAt = transactionDate;
  }
  
  const [updated] = await tx
    .update(contacts)
    .set(updateData)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
    .returning();

  if (updated && updated.linkedUserId) {
    const reciprocalContact = await tx.query.contacts.findFirst({
      where: and(eq(contacts.userId, updated.linkedUserId), eq(contacts.linkedUserId, userId))
    });
    
    if (reciprocalContact) {
      const reciprocalData: any = {
        netBalance: sql`COALESCE(${contacts.netBalance}, 0) + ${String(-delta)}`,
        transactionCount: sql`COALESCE(${contacts.transactionCount}, 0) + ${String(countDelta)}`,
      };
      if (transactionDate) {
        reciprocalData.lastTransactionAt = transactionDate;
      }
      await tx
        .update(contacts)
        .set(reciprocalData)
        .where(eq(contacts.id, reciprocalContact.id));
    }
  }
}

// Mapper to strongly typed `TransactionWithJoins`
function mapTransactionRow(t: any): TransactionWithJoins {
  return {
    id: t.id,
    user_id: t.userId,
    amount: Number(t.amount),
    flow: t.flow as "IN" | "OUT",
    mode: t.mode as "BUSINESS" | "PERSONAL",
    name: t.name,
    note: t.note || null,
    date: t.date ? new Date(t.date).toISOString() : new Date().toISOString(),
    due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    contact_id: t.contactId || null,
    category_id: t.categoryId || null,
    account_id: t.accountId || null,
    business_id: t.businessId || null,
    group_id: t.groupId || null,
    payer_id: t.payerId || null,
    payer_group_member_id: t.payerGroupMemberId || null,
    split_type: (t.splitType as any) || null,
    
    // Relations
    category: t.category ? { name: t.category.name, icon: t.category.icon } : null,
    account: t.account ? { name: t.account.name } : null,
    contact: t.contact ? { id: t.contact.id, name: t.contact.name } : null,
    contacts: t.contact ? { name: t.contact.name, phone: t.contact.phone || null } : undefined, // backwards compat
    payer: t.payer ? { full_name: t.payer.name, avatar_url: t.payer.image || null } : null,
    group: t.group ? { id: t.group.id, name: t.group.name } : null,
    splits: t.splits ? t.splits.map((s: any): TransactionSplit => ({
      id: s.id,
      transaction_id: s.transactionId,
      user_id: s.userId || null,
      group_member_id: s.groupMemberId || null,
      amount: Number(s.amount),
      percentage: s.percentage ? Number(s.percentage) : undefined,
      is_settled: s.isSettled ?? false,
      member_name_snapshot: s.memberNameSnapshot || null,
    })) : [],
  };
}

// Actions
export const createTransactionAction = rpcActionWithAuth(
  CreateTransactionSchema,
  async (input, currentUser) => {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, currentUser.id),
      columns: {
        personalSetupStatus: true,
        businessSetupStatus: true
      }
    });

    if (profile) {
      const targetMode = input.mode.toLowerCase() as "personal" | "business";
      const statusField = `${targetMode}SetupStatus` as const;
      if (profile[statusField] === 'PENDING') {
        throw new Error(`ONBOARDING_REQUIRED:${targetMode}`);
      }
    }

    return await db.transaction(async (tx) => {
      const [insertedTx] = await tx
        .insert(transactions)
        .values({
          userId: currentUser.id,
          businessId: input.mode === "BUSINESS" ? input.businessId || null : null,
          amount: String(input.amount),
          flow: input.flow,
          mode: input.mode,
          name: input.name,
          note: input.note || null,
          date: new Date(input.date),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          contactId: input.contactId || null,
          categoryId: input.categoryId || null,
          accountId: input.accountId || null,
          groupId: input.groupId || null,
          payerId: input.payerId || currentUser.id,
          payerGroupMemberId: input.payerGroupMemberId || null,
          splitType: input.splitType || "EQUALLY",
        })
        .returning();

      if (input.splits && input.splits.length > 0) {
        await tx.insert(transactionSplits).values(
          input.splits.map((s) => ({
            transactionId: insertedTx.id,
            userId: s.userId || null,
            groupMemberId: s.groupMemberId || null,
            amount: String(s.amount),
            percentage: s.percentage != null ? String(s.percentage) : null,
            isSettled: s.isSettled || false,
            memberNameSnapshot: s.memberNameSnapshot || null,
          }))
        );
      }

      if (input.accountId) {
        const delta = -getSignedFlowDelta(input.flow, input.amount);
        await updateAccountBalance(tx, input.accountId, currentUser.id, delta);
      }
      if (input.contactId) {
        const contactDelta = getSignedFlowDelta(input.flow, input.amount);
        await updateContactStats(tx, input.contactId, currentUser.id, contactDelta, 1, new Date(input.date));
      }

      return { id: insertedTx.id, transaction: insertedTx };
    });
  }
);

export const getTransactionsAction = rpcActionWithAuth(
  GetTransactionsFiltersSchema.optional().default({ limit: 20, offset: 0 }),
  async (filters, currentUser): Promise<TransactionWithJoins[]> => {
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    const whereConditions = [isNull(transactions.deletedAt)];

    if (filters?.contactId) {
      const contactRecord = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, filters.contactId), eq(contacts.userId, currentUser.id))
      });
      if (contactRecord?.linkedUserId) {
        const reciprocal = await db.query.contacts.findFirst({
          where: and(eq(contacts.userId, contactRecord.linkedUserId), eq(contacts.linkedUserId, currentUser.id))
        });
        if (reciprocal) {
          whereConditions.push(inArray(transactions.contactId, [filters.contactId, reciprocal.id]));
        } else {
          whereConditions.push(eq(transactions.contactId, filters.contactId));
        }
      } else {
        whereConditions.push(eq(transactions.contactId, filters.contactId));
      }
    } else if (filters?.groupId) {
      whereConditions.push(eq(transactions.groupId, filters.groupId));
    } else if (filters?.mode) {
      whereConditions.push(eq(transactions.mode, filters.mode));
      whereConditions.push(eq(transactions.userId, currentUser.id));
    } else {
      whereConditions.push(eq(transactions.userId, currentUser.id));
    }

    const rows = await db.query.transactions.findMany({
      where: and(...whereConditions),
      orderBy: [desc(transactions.date)],
      limit,
      offset,
      with: {
        category: { columns: { name: true, icon: true } },
        account: { columns: { name: true, type: true } },
        contact: { columns: { id: true, name: true, phone: true } },
        group: { columns: { id: true, name: true } },
        payer: { columns: { id: true, name: true, image: true } },
        splits: true,
      },
    });

    return rows.map(mapTransactionRow);
  }
);

export const getPersonalTransactionsAction = rpcActionWithAuth(
  z.object({ limit: z.number().optional().default(100), offset: z.number().optional().default(0) }).optional().default({ limit: 100, offset: 0 }),
  async (filters, currentUser): Promise<TransactionWithJoins[]> => {
    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;
    const rows = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, currentUser.id),
        eq(transactions.mode, "PERSONAL"),
        isNull(transactions.deletedAt)
      ),
      orderBy: [desc(transactions.date)],
      limit,
      offset,
      with: {
        category: { columns: { id: true, name: true, icon: true } },
        account: { columns: { id: true, name: true, type: true } },
        contact: { columns: { id: true, name: true } },
        group: { columns: { id: true, name: true } },
      },
    });

    return rows.map(mapTransactionRow);
  }
);

export const getUnifiedTransactionsAction = rpcActionWithAuth(
  z.object({ limit: z.number().optional().default(100), offset: z.number().optional().default(0) }).optional().default({ limit: 100, offset: 0 }),
  async (filters, currentUser): Promise<TransactionWithJoins[]> => {
    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;
    
    const myReciprocalContacts = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.linkedUserId, currentUser.id));
    const reciprocalContactIds = myReciprocalContacts.map(c => c.id);
    
    const baseConditions = [
      eq(transactions.userId, currentUser.id),
      eq(transactions.payerId, currentUser.id)
    ];
    if (reciprocalContactIds.length > 0) {
      baseConditions.push(inArray(transactions.contactId, reciprocalContactIds));
    }
    
    const rows = await db.query.transactions.findMany({
      where: and(
        or(...baseConditions),
        isNull(transactions.deletedAt)
      ),
      orderBy: [desc(transactions.date)],
      limit,
      offset,
      with: {
        category: { columns: { name: true, icon: true } },
        account: { columns: { name: true, type: true } },
        contact: { columns: { id: true, name: true, phone: true } },
        group: { columns: { id: true, name: true } },
        payer: { columns: { id: true, name: true, image: true } },
        splits: true,
      },
    });

    return rows.map(mapTransactionRow);
  }
);

export const updateTransactionAction = rpcActionWithAuth(
  UpdateTransactionSchema,
  async (input, currentUser) => {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.id),
          eq(transactions.userId, currentUser.id),
          isNull(transactions.deletedAt)
        ),
      });

      if (!existing) {
        throw new Error("Transaction not found");
      }

      const oldAccountId = existing.accountId;
      const oldAmount = Number(existing.amount);
      const oldFlow = existing.flow as "IN" | "OUT";

      const newAccountId = input.accountId || null;
      const newAmount = input.amount;
      const newFlow = input.flow;

      if (oldAccountId && oldAccountId === newAccountId) {
        const oldNet = -getSignedFlowDelta(oldFlow, oldAmount);
        const newNet = -getSignedFlowDelta(newFlow, newAmount);
        const netDelta = newNet - oldNet;
        await updateAccountBalance(tx, oldAccountId, currentUser.id, netDelta);
      } else {
        if (oldAccountId) {
          const revertDelta = getSignedFlowDelta(oldFlow, oldAmount);
          await updateAccountBalance(tx, oldAccountId, currentUser.id, revertDelta);
        }

        if (newAccountId) {
          const applyDelta = -getSignedFlowDelta(newFlow, newAmount);
          await updateAccountBalance(tx, newAccountId, currentUser.id, applyDelta);
        }
      }

      const oldContactId = existing.contactId;
      const newContactId = input.contactId || null;
      
      if (oldContactId && oldContactId === newContactId) {
        const oldNet = getSignedFlowDelta(oldFlow, oldAmount);
        const newNet = getSignedFlowDelta(newFlow, newAmount);
        const netDelta = newNet - oldNet;
        await updateContactStats(tx, oldContactId, currentUser.id, netDelta, 0, new Date(input.date));
      } else {
        if (oldContactId) {
          const revertDelta = -getSignedFlowDelta(oldFlow, oldAmount);
          await updateContactStats(tx, oldContactId, currentUser.id, revertDelta, -1);
        }
        if (newContactId) {
          const applyDelta = getSignedFlowDelta(newFlow, newAmount);
          await updateContactStats(tx, newContactId, currentUser.id, applyDelta, 1, new Date(input.date));
        }
      }

      const [updated] = await tx
        .update(transactions)
        .set({
          amount: String(input.amount),
          flow: input.flow,
          mode: input.mode,
          name: input.name,
          note: input.note || null,
          date: new Date(input.date),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          contactId: input.contactId || null,
          categoryId: input.categoryId || null,
          accountId: input.accountId || null,
        })
        .where(and(eq(transactions.id, input.id), eq(transactions.userId, currentUser.id)))
        .returning();

      return updated;
    });
  }
);

export const deleteTransactionAction = rpcActionWithAuth(
  z.string().uuid(),
  async (id, currentUser) => {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.transactions.findFirst({
        where: and(
          eq(transactions.id, id),
          eq(transactions.userId, currentUser.id),
          isNull(transactions.deletedAt)
        ),
      });

      if (!existing) {
        throw new Error("Transaction not found");
      }

      if (existing.accountId) {
        const oldAmount = Number(existing.amount);
        const revertDelta = getSignedFlowDelta(existing.flow as "IN" | "OUT", oldAmount);
        await updateAccountBalance(tx, existing.accountId, currentUser.id, revertDelta);
      }

      if (existing.contactId) {
        const oldAmount = Number(existing.amount);
        const revertDelta = -getSignedFlowDelta(existing.flow as "IN" | "OUT", oldAmount);
        await updateContactStats(tx, existing.contactId, currentUser.id, revertDelta, -1);

        await notifyTransactionDeleted(tx, existing, currentUser as any);
      } else if (existing.groupId) {
        await notifyTransactionDeleted(tx, existing, currentUser as any);
      }

      await tx
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(and(eq(transactions.id, id), eq(transactions.userId, currentUser.id)));

      return { success: true };
    });
  }
);
