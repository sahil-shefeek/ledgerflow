"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth-session";
import {
  transactions,
  transactionSplits,
  categories,
  accounts,
  contacts,
  groups,
  user,
  profiles,
  notifications,
} from "@/db/schema";
import { eq, and, desc, or, isNull, sql } from "drizzle-orm";
import { getSignedFlowDelta } from "@/lib/currency";
import { notifyTransactionDeleted } from "@/lib/domain/notifications";

export interface SplitInput {
  userId?: string | null;
  groupMemberId?: string | null;
  amount: number; // in paise
  percentage?: number | null;
  isSettled?: boolean;
  memberNameSnapshot?: string | null;
}

export interface CreateTransactionInput {
  amount: number; // in paise
  flow: "IN" | "OUT";
  mode: "BUSINESS" | "PERSONAL";
  name: string;
  note?: string | null;
  date: Date | string;
  dueDate?: Date | string | null;
  contactId?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  businessId?: string | null;
  groupId?: string | null;
  payerId?: string | null;
  payerGroupMemberId?: string | null;
  splitType?: "EQUALLY" | "BY_AMOUNT" | "BY_PERCENTAGE";
  splits?: SplitInput[] | null;
}

export interface UpdateTransactionInput {
  id: string;
  amount: number; // in paise
  flow: "IN" | "OUT";
  mode: "BUSINESS" | "PERSONAL";
  name: string;
  note?: string | null;
  date: Date | string;
  dueDate?: Date | string | null;
  contactId?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
}

export interface GetTransactionsFilters {
  mode?: "BUSINESS" | "PERSONAL";
  contactId?: string | null;
  groupId?: string | null;
  limit?: number;
  offset?: number;
}

/**
 * Updates an account balance atomically using explicit string formatting for monetary delta.
 * Solves primitive obsession / float arithmetic issues on Postgres numeric balance columns.
 */
async function updateAccountBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  accountId: string,
  userId: string,
  delta: number
) {
  if (delta === 0) return;
  const formattedDelta = String(delta);
  await tx
    .update(accounts)
    .set({ balance: sql`${accounts.balance} + ${formattedDelta}` })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
}

async function updateContactStats(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
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
  await tx
    .update(contacts)
    .set(updateData)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));
}

export async function createTransactionAction(
  input: CreateTransactionInput
) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  const profile = await db.select({
    modeSetupState: profiles.modeSetupState
  }).from(profiles).where(eq(profiles.id, currentUser.id)).limit(1);

  if (profile.length > 0 && profile[0].modeSetupState) {
    const p = profile[0].modeSetupState as any;
    const targetMode = input.mode.toLowerCase();
    if (targetMode === 'personal' && p.personal?.status === 'PENDING') {
      throw new Error("Must complete personal onboarding first.");
    }
    if (targetMode === 'business' && p.business?.status === 'PENDING') {
      throw new Error("Must complete business onboarding first.");
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

    return { id: insertedTx.id, success: true, transaction: insertedTx };
  });
}

/**
 * Fetches transactions filtered by mode, contactId, or groupId.
 */
export async function getTransactionsAction(
  filters?: GetTransactionsFilters
) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  const limit = filters?.limit ?? 20;
  const offset = filters?.offset ?? 0;

  const whereConditions = [isNull(transactions.deletedAt)];

  if (filters?.contactId) {
    whereConditions.push(eq(transactions.contactId, filters.contactId));
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
      category: {
        columns: {
          name: true,
          icon: true,
        },
      },
      account: {
        columns: {
          name: true,
          type: true,
        },
      },
      contact: {
        columns: {
          id: true,
          name: true,
          phone: true,
        },
      },
      group: {
        columns: {
          id: true,
          name: true,
        },
      },
      payer: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
      splits: true,
    },
  });

  return rows.map((t) => ({
    id: t.id,
    user_id: t.userId,
    amount: Number(t.amount),
    flow: t.flow as "IN" | "OUT",
    mode: t.mode as "BUSINESS" | "PERSONAL",
    name: t.name,
    note: t.note || undefined,
    date: t.date ? t.date.toISOString() : new Date().toISOString(),
    due_date: t.dueDate ? t.dueDate.toISOString() : undefined,
    contact_id: t.contactId || undefined,
    category_id: t.categoryId || undefined,
    account_id: t.accountId || undefined,
    group_id: t.groupId || undefined,
    payer_id: t.payerId || undefined,
    payer_group_member_id: t.payerGroupMemberId || undefined,
    split_type: t.splitType as "EQUALLY" | "BY_AMOUNT" | "BY_PERCENTAGE" | undefined,
    contacts: t.contact ? { name: t.contact.name, phone: t.contact.phone || undefined } : null,
    category: t.category,
    account: t.account,
    contact: t.contact ? { id: t.contact.id, name: t.contact.name } : null,
    payer: t.payer ? { full_name: t.payer.name, avatar_url: t.payer.image || undefined } : null,
    group: t.group,
    splits: t.splits.map((s) => ({
      id: s.id,
      user_id: s.userId || undefined,
      group_member_id: s.groupMemberId || undefined,
      amount: Number(s.amount),
      percentage: s.percentage ? Number(s.percentage) : null,
      is_settled: s.isSettled ?? false,
      member_name_snapshot: s.memberNameSnapshot || null,
    })),
  }));
}

/**
 * Fetches personal transactions for the logged-in user.
 */
export async function getPersonalTransactionsAction(
  filters?: {
    limit?: number;
    offset?: number;
  }
) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    throw new Error("Unauthorized");
  }

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
      category: {
        columns: {
          id: true,
          name: true,
          icon: true,
        },
      },
      account: {
        columns: {
          id: true,
          name: true,
          type: true,
        },
      },
      contact: {
        columns: {
          id: true,
          name: true,
        },
      },
      group: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    flow: t.flow as "IN" | "OUT",
    name: t.name,
    note: t.note || undefined,
    date: t.date ? t.date.toISOString() : new Date().toISOString(),
    category_id: t.categoryId || undefined,
    account_id: t.accountId || undefined,
    contact_id: t.contactId || undefined,
    mode: t.mode as "PERSONAL" | "BUSINESS",
    category: t.category,
    account: t.account,
    contact: t.contact,
    group: t.group,
  }));
}

/**
 * Fetches unified transactions feed combining personal, contact, and group transactions.
 */
export async function getUnifiedTransactionsAction(
  filters?: {
    limit?: number;
    offset?: number;
  }
) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;

  const rows = await db.query.transactions.findMany({
    where: and(
      or(
        eq(transactions.userId, currentUser.id),
        eq(transactions.payerId, currentUser.id)
      ),
      isNull(transactions.deletedAt)
    ),
    orderBy: [desc(transactions.date)],
    limit,
    offset,
    with: {
      category: {
        columns: {
          name: true,
          icon: true,
        },
      },
      account: {
        columns: {
          name: true,
          type: true,
        },
      },
      contact: {
        columns: {
          id: true,
          name: true,
          phone: true,
        },
      },
      group: {
        columns: {
          id: true,
          name: true,
        },
      },
      payer: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
      splits: true,
    },
  });

  return rows.map((t) => ({
    id: t.id,
    user_id: t.userId,
    amount: Number(t.amount),
    flow: t.flow as "IN" | "OUT",
    mode: t.mode as "BUSINESS" | "PERSONAL",
    name: t.name,
    note: t.note || undefined,
    date: t.date ? t.date.toISOString() : new Date().toISOString(),
    due_date: t.dueDate ? t.dueDate.toISOString() : undefined,
    contact_id: t.contactId || undefined,
    category_id: t.categoryId || undefined,
    account_id: t.accountId || undefined,
    group_id: t.groupId || undefined,
    payer_id: t.payerId || undefined,
    contacts: t.contact ? { name: t.contact.name, phone: t.contact.phone || undefined } : null,
    category: t.category,
    account: t.account,
    contact: t.contact ? { id: t.contact.id, name: t.contact.name } : null,
    payer: t.payer ? { full_name: t.payer.name, avatar_url: t.payer.image || undefined } : null,
    group: t.group,
    splits: t.splits.map((s) => ({
      id: s.id,
      user_id: s.userId || undefined,
      group_member_id: s.groupMemberId || undefined,
      amount: Number(s.amount),
      percentage: s.percentage ? Number(s.percentage) : null,
      is_settled: s.isSettled ?? false,
      member_name_snapshot: s.memberNameSnapshot || null,
    })),
  }));
}

/**
 * Updates an existing transaction if owned by the logged-in user.
 * Automatically calculates monetary deltas and updates account balances atomically.
 */
export async function updateTransactionAction(
  input: UpdateTransactionInput
) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  return await db.transaction(async (tx) => {
    const existing = await tx.query.transactions.findFirst({
      where: and(
        eq(transactions.id, input.id),
        eq(transactions.userId, currentUser.id),
        isNull(transactions.deletedAt)
      ),
    });

    if (!existing) {
      throw new Error("Unauthorized or transaction not found");
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

/**
 * Soft-deletes a transaction by ID if owned by the logged-in user.
 * Automatically restores or deducts transaction amount to associated account balance atomically.
 */
export async function deleteTransactionAction(id: string) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  return await db.transaction(async (tx) => {
    const existing = await tx.query.transactions.findFirst({
      where: and(
        eq(transactions.id, id),
        eq(transactions.userId, currentUser.id),
        isNull(transactions.deletedAt)
      ),
    });

    if (!existing) {
      throw new Error("Unauthorized or transaction not found");
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

      await notifyTransactionDeleted(tx, existing, currentUser);
    } else if (existing.groupId) {
      await notifyTransactionDeleted(tx, existing, currentUser);
    }

    await tx
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, currentUser.id)));

    return { success: true };
  });
}
