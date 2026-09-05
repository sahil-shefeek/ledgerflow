import { test as baseTest, expect, type BrowserContext, type Page } from '@playwright/test';
// Environment variables loaded via Next.js or dotenv

import { db } from '@/db';
import { user, profiles, account, session, verification } from '@/db/schema/auth';
import {
  accounts,
  businesses,
  categories,
  transactions,
  transactionSplits,
  recurringTransactions,
} from '@/db/schema/financial';
import { contacts, friendships, groups, groupMembers, notifications } from '@/db/schema/social';
import { ledgers, personalLedgers, friendLedgers } from '@/db/schema/ledgers';
import { userSettings } from '@/db/schema/user-settings';
import { goals, goalContributions } from '@/db/schema/goals';
import { auth } from '@/lib/auth';
import { eq, inArray, like, or } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Registry to track dynamically seeded test entities per worker
 */
export interface TrackedTestData {
  userIds: Set<string>;
  groupIds: Set<string>;
  contactIds: Set<string>;
  accountIds: Set<string>;
  ledgerIds: Set<string>;
  memberIds: Set<string>;
}

export const globalTestDataTracker: TrackedTestData = {
  userIds: new Set<string>(),
  groupIds: new Set<string>(),
  contactIds: new Set<string>(),
  accountIds: new Set<string>(),
  ledgerIds: new Set<string>(),
  memberIds: new Set<string>(),
};

/**
 * Generate a safe unique prefix for test entities
 */
export function generateTestPrefix(tag = 'e2e'): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  return `e2e_test_${tag}_${timestamp}_${randomStr}`;
}

export interface SeedUserOptions {
  name?: string;
  email?: string;
  password?: string;
  username?: string;
}

export interface SeededUserResult {
  user: {
    id: string;
    name: string;
    email: string;
  };
  password: string;
  sessionToken?: string;
  cookies?: Array<{ name: string; value: string }>;
}

/**
 * Dynamically seed a registered profile with Better Auth credentials & session
 */
export async function seedRegisteredUser(options: SeedUserOptions = {}): Promise<SeededUserResult> {
  const prefix = generateTestPrefix('user');
  const email = options.email || `${prefix}@example.com`;
  const password = options.password || 'TestPassword123!';
  const name = options.name || `Test User ${prefix.slice(-6)}`;

  // Attempt sign up via Better Auth server API
  const res = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
    },
    asResponse: true,
  });

  if (!res || !res.ok) {
    const errorText = await res?.text().catch(() => 'Unknown error');
    throw new Error(`[seedRegisteredUser] Failed to sign up user via Better Auth: ${errorText}`);
  }

  interface SignUpResponseData {
    user: { id: string; name: string; email: string };
    token?: string;
    session?: { token: string };
  }

  const data = (await res.json()) as SignUpResponseData;
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const parsedCookies = setCookies.map((cookieStr) => {
    const parts = cookieStr.split(';');
    const [nameValue] = parts;
    const eqIdx = nameValue.indexOf('=');
    const cookieName = nameValue.substring(0, eqIdx);
    const value = nameValue.substring(eqIdx + 1);
    return { name: cookieName.trim(), value: value.trim() };
  });

  // Ensure profile is onboarded and username is set if requested
  await db
    .insert(profiles)
    .values({
      id: data.user.id,
      fullName: name,
      username: options.username || data.user.id,
      email: data.user.email,
      globalOnboardingStatus: "COMPLETED",
      personalSetupStatus: "COMPLETED",
      businessSetupStatus: "COMPLETED"
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        fullName: name,
        globalOnboardingStatus: "COMPLETED",
        personalSetupStatus: "COMPLETED",
        businessSetupStatus: "COMPLETED",
        ...(options.username ? { username: options.username } : {}),
      },
    });

  globalTestDataTracker.userIds.add(data.user.id);

  return {
    user: {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
    },
    password,
    sessionToken: data.token || data.session?.token,
    cookies: parsedCookies,
  };
}

export interface SeedContactOptions {
  name?: string;
  phone?: string;
  type?: 'CUSTOMER' | 'SUPPLIER' | 'OTHER';
  netBalance?: string;
  businessId?: string;
  linkedUserId?: string;
}

/**
 * Dynamically seed an unregistered (or registered linked) contact for a user
 */
export async function seedUnregisteredContact(
  userId: string,
  options: SeedContactOptions = {}
) {
  const prefix = generateTestPrefix('contact');
  const contactId = crypto.randomUUID();

  const contactData = {
    id: contactId,
    userId,
    name: options.name || `Contact ${prefix.slice(-6)}`,
    phone: options.phone || `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
    type: options.type || 'OTHER',
    netBalance: options.netBalance || '0.00',
    businessId: options.businessId || null,
    linkedUserId: options.linkedUserId || null,
  };

  const [inserted] = await db.insert(contacts).values(contactData).returning();
  globalTestDataTracker.contactIds.add(inserted.id);

  return inserted;
}

export interface SeedGhostMemberOptions {
  ghostName?: string;
  avatarUrl?: string;
}

/**
 * Dynamically seed a ghost member inside a group
 */
export async function seedGhostMember(
  groupId: string,
  options: SeedGhostMemberOptions = {}
) {
  const prefix = generateTestPrefix('ghost');
  const memberId = crypto.randomUUID();

  const memberData = {
    id: memberId,
    groupId,
    userId: null,
    ghostName: options.ghostName || `Ghost ${prefix.slice(-6)}`,
    avatarUrl: options.avatarUrl || null,
  };

  const [inserted] = await db.insert(groupMembers).values(memberData).returning();
  globalTestDataTracker.memberIds.add(inserted.id);
  return inserted;
}

export interface SeedBankAccountOptions {
  name?: string;
  type?: 'CASH' | 'BANK' | 'WALLET' | 'OTHER';
  balance?: string;
  isDefault?: boolean;
}

/**
 * Dynamically seed a bank/financial account for a user
 */
export async function seedBankAccount(
  userId: string,
  options: SeedBankAccountOptions = {}
) {
  const prefix = generateTestPrefix('acc');
  const accountId = crypto.randomUUID();

  const accountData = {
    id: accountId,
    userId,
    name: options.name || `Bank Account ${prefix.slice(-6)}`,
    type: options.type || 'BANK',
    balance: options.balance || '1000.00',
    isDefault: options.isDefault ?? false,
  };

  const [inserted] = await db.insert(accounts).values(accountData).returning();
  globalTestDataTracker.accountIds.add(inserted.id);

  return inserted;
}

export interface SeedGroupLedgerOptions {
  name?: string;
  type?: string;
  memberUserIds?: string[];
  ghostNames?: string[];
}

/**
 * Dynamically seed a group and its corresponding ledger with members & ghost members
 */
export async function seedGroupLedger(
  createdByUserId: string,
  options: SeedGroupLedgerOptions = {}
) {
  const prefix = generateTestPrefix('group');
  const groupId = crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const groupName = options.name || `Group ${prefix.slice(-6)}`;

  // Create Group
  const [group] = await db
    .insert(groups)
    .values({
      id: groupId,
      name: groupName,
      createdBy: createdByUserId,
      type: options.type || 'GENERAL',
    })
    .returning();

  globalTestDataTracker.groupIds.add(group.id);

  // Add Creator as member
  const membersList = [];
  const [creatorMember] = await db
    .insert(groupMembers)
    .values({
      groupId,
      userId: createdByUserId,
    })
    .returning();
  membersList.push(creatorMember);
  globalTestDataTracker.memberIds.add(creatorMember.id);

  // Add additional registered user members
  if (options.memberUserIds && options.memberUserIds.length > 0) {
    for (const memberUserId of options.memberUserIds) {
      if (memberUserId !== createdByUserId) {
        const [m] = await db
          .insert(groupMembers)
          .values({
            groupId,
            userId: memberUserId,
          })
          .returning();
        membersList.push(m);
        globalTestDataTracker.memberIds.add(m.id);
      }
    }
  }

  // Add ghost members
  if (options.ghostNames && options.ghostNames.length > 0) {
    for (const ghostName of options.ghostNames) {
      const [g] = await db
        .insert(groupMembers)
        .values({
          groupId,
          userId: null,
          ghostName,
        })
        .returning();
      membersList.push(g);
      globalTestDataTracker.memberIds.add(g.id);
    }
  }

  // Create corresponding Ledger
  const [ledger] = await db
    .insert(ledgers)
    .values({
      id: ledgerId,
      userId: createdByUserId,
      name: groupName,
      type: 'GROUP',
      description: `Group ledger for ${groupName}`,
    })
    .returning();

  globalTestDataTracker.ledgerIds.add(ledger.id);

  return {
    group,
    members: membersList,
    ledger,
  };
}

/**
 * Helper to attach session cookies to a Playwright BrowserContext for auto-login
 */
export async function authenticateContext(
  context: BrowserContext,
  sessionToken: string | undefined,
  baseURL = 'http://127.0.0.1:3000',
  cookies?: Array<{ name: string; value: string }>
) {
  const url = new URL(baseURL);

  if (cookies && cookies.length > 0) {
    const playwrightCookies = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: url.hostname,
      path: '/',
    }));
    await context.addCookies(playwrightCookies);
  } else if (sessionToken) {
    await context.addCookies([
      {
        name: 'ledgerflow.session_token',
        value: sessionToken,
        domain: url.hostname,
        path: '/',
      },
    ]);
  }
}

export interface CleanupTestDataOptions {
  userIds?: string[];
  groupIds?: string[];
  contactIds?: string[];
  accountIds?: string[];
  ledgerIds?: string[];
  memberIds?: string[];
  wipeAllTestEntities?: boolean;
}

/**
 * Teardown utility to reliably wipe test entities from the database
 */
export async function cleanupTestData(options: CleanupTestDataOptions = {}): Promise<void> {
  const targetUserIds = new Set<string>(options.userIds || []);
  const targetGroupIds = new Set<string>(options.groupIds || []);
  const targetContactIds = new Set<string>(options.contactIds || []);
  const targetAccountIds = new Set<string>(options.accountIds || []);
  const targetLedgerIds = new Set<string>(options.ledgerIds || []);
  const targetMemberIds = new Set<string>(options.memberIds || []);

  // If no specific IDs passed, wipe everything in the tracking registry
  if (
    !options.userIds &&
    !options.groupIds &&
    !options.contactIds &&
    !options.accountIds &&
    !options.ledgerIds &&
    !options.memberIds
  ) {
    globalTestDataTracker.userIds.forEach((id) => targetUserIds.add(id));
    globalTestDataTracker.groupIds.forEach((id) => targetGroupIds.add(id));
    globalTestDataTracker.contactIds.forEach((id) => targetContactIds.add(id));
    globalTestDataTracker.accountIds.forEach((id) => targetAccountIds.add(id));
    globalTestDataTracker.ledgerIds.forEach((id) => targetLedgerIds.add(id));
    globalTestDataTracker.memberIds.forEach((id) => targetMemberIds.add(id));
  }

  if (options.wipeAllTestEntities) {
    try {
      const testUsers = await db
        .select({ id: user.id })
        .from(user)
        .where(
          or(
            like(user.email, 'e2e_test_%'),
            like(user.id, 'usr_e2e_test_%'),
            like(user.id, 'e2e_test_%')
          )
        );
      testUsers.forEach((u) => targetUserIds.add(u.id));
    } catch (e) {
      console.error('[cleanupTestData] Error querying test users by prefix:', e);
    }
  }

  const userIds = Array.from(targetUserIds);
  const groupIds = Array.from(targetGroupIds);
  const contactIds = Array.from(targetContactIds);
  const accountIds = Array.from(targetAccountIds);
  const ledgerIds = Array.from(targetLedgerIds);
  const memberIds = Array.from(targetMemberIds);

  if (
    userIds.length === 0 &&
    groupIds.length === 0 &&
    contactIds.length === 0 &&
    accountIds.length === 0 &&
    ledgerIds.length === 0 &&
    memberIds.length === 0
  ) {
    return;
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Transaction splits
      const splitConditions = [];
      if (userIds.length > 0) splitConditions.push(inArray(transactionSplits.userId, userIds));
      if (memberIds.length > 0) splitConditions.push(inArray(transactionSplits.groupMemberId, memberIds));
      if (splitConditions.length > 0) {
        await tx.delete(transactionSplits).where(or(...splitConditions));
      }

      // 2. Recurring Transactions
      const recConditions = [];
      if (userIds.length > 0) recConditions.push(inArray(recurringTransactions.userId, userIds));
      if (accountIds.length > 0) recConditions.push(inArray(recurringTransactions.accountId, accountIds));
      if (recConditions.length > 0) {
        await tx.delete(recurringTransactions).where(or(...recConditions));
      }

      // 3. Transactions
      const txConditions = [];
      if (userIds.length > 0) {
        txConditions.push(inArray(transactions.userId, userIds));
        txConditions.push(inArray(transactions.payerId, userIds));
      }
      if (contactIds.length > 0) txConditions.push(inArray(transactions.contactId, contactIds));
      if (accountIds.length > 0) txConditions.push(inArray(transactions.accountId, accountIds));
      if (groupIds.length > 0) txConditions.push(inArray(transactions.groupId, groupIds));
      if (txConditions.length > 0) {
        await tx.delete(transactions).where(or(...txConditions));
      }

      // 4. Notifications
      if (userIds.length > 0) {
        await tx.delete(notifications).where(inArray(notifications.userId, userIds));
      }

      // 5. Friendships
      if (userIds.length > 0) {
        await tx
          .delete(friendships)
          .where(
            or(
              inArray(friendships.userId1, userIds),
              inArray(friendships.userId2, userIds),
              inArray(friendships.initiatorId, userIds)
            )
          );
      }

      // 6. Contacts
      const contactConditions = [];
      if (contactIds.length > 0) contactConditions.push(inArray(contacts.id, contactIds));
      if (userIds.length > 0) {
        contactConditions.push(inArray(contacts.userId, userIds));
        contactConditions.push(inArray(contacts.linkedUserId, userIds));
      }
      if (contactConditions.length > 0) {
        await tx.delete(contacts).where(or(...contactConditions));
      }

      // 7. Group Members
      const memberConditions = [];
      if (memberIds.length > 0) memberConditions.push(inArray(groupMembers.id, memberIds));
      if (groupIds.length > 0) memberConditions.push(inArray(groupMembers.groupId, groupIds));
      if (userIds.length > 0) memberConditions.push(inArray(groupMembers.userId, userIds));
      if (memberConditions.length > 0) {
        await tx.delete(groupMembers).where(or(...memberConditions));
      }

      // 8. Groups
      const groupConditions = [];
      if (groupIds.length > 0) groupConditions.push(inArray(groups.id, groupIds));
      if (userIds.length > 0) groupConditions.push(inArray(groups.createdBy, userIds));
      if (groupConditions.length > 0) {
        await tx.delete(groups).where(or(...groupConditions));
      }

      // 9. Friend Ledgers & Personal Ledgers
      const ledgerConditions = [];
      if (ledgerIds.length > 0) ledgerConditions.push(inArray(friendLedgers.ledgerId, ledgerIds));
      if (userIds.length > 0) {
        ledgerConditions.push(inArray(friendLedgers.userId, userIds));
        ledgerConditions.push(inArray(friendLedgers.friendId, userIds));
      }
      if (ledgerConditions.length > 0) {
        await tx.delete(friendLedgers).where(or(...ledgerConditions));
      }

      const personalLedgerConditions = [];
      if (ledgerIds.length > 0) personalLedgerConditions.push(inArray(personalLedgers.ledgerId, ledgerIds));
      if (userIds.length > 0) personalLedgerConditions.push(inArray(personalLedgers.userId, userIds));
      if (personalLedgerConditions.length > 0) {
        await tx.delete(personalLedgers).where(or(...personalLedgerConditions));
      }

      // 10. Ledgers
      const lConditions = [];
      if (ledgerIds.length > 0) lConditions.push(inArray(ledgers.id, ledgerIds));
      if (userIds.length > 0) lConditions.push(inArray(ledgers.userId, userIds));
      if (lConditions.length > 0) {
        await tx.delete(ledgers).where(or(...lConditions));
      }

      // 11. Goal Contributions & Goals
      if (userIds.length > 0) {
        await tx.delete(goalContributions).where(inArray(goalContributions.userId, userIds));
        await tx.delete(goals).where(inArray(goals.userId, userIds));
      }

      // 12. Categories & Businesses
      if (userIds.length > 0) {
        await tx.delete(categories).where(inArray(categories.userId, userIds));
        await tx.delete(businesses).where(inArray(businesses.userId, userIds));
      }

      // 13. Accounts
      const accConditions = [];
      if (accountIds.length > 0) accConditions.push(inArray(accounts.id, accountIds));
      if (userIds.length > 0) accConditions.push(inArray(accounts.userId, userIds));
      if (accConditions.length > 0) {
        await tx.delete(accounts).where(or(...accConditions));
      }

      // 14. User settings & Auth
      if (userIds.length > 0) {
        await tx.delete(userSettings).where(inArray(userSettings.userId, userIds));
        await tx.delete(profiles).where(inArray(profiles.id, userIds));
        await tx.delete(session).where(inArray(session.userId, userIds));
        await tx.delete(account).where(inArray(account.userId, userIds));
        await tx.delete(user).where(inArray(user.id, userIds));
      }
    });
  } catch (err) {
    console.error('[cleanupTestData] Failed to cleanup entities:', err);
    throw err;
  } finally {
    // Clear tracked entries
    userIds.forEach((id) => globalTestDataTracker.userIds.delete(id));
    groupIds.forEach((id) => globalTestDataTracker.groupIds.delete(id));
    contactIds.forEach((id) => globalTestDataTracker.contactIds.delete(id));
    accountIds.forEach((id) => globalTestDataTracker.accountIds.delete(id));
    ledgerIds.forEach((id) => globalTestDataTracker.ledgerIds.delete(id));
    memberIds.forEach((id) => globalTestDataTracker.memberIds.delete(id));
  }
}

/**
 * Custom Playwright fixture definitions extending @playwright/test
 */
export interface CustomTestFixtures {
  baseURL: string;
  userAContext: BrowserContext;
  userBContext: BrowserContext;
  userAPage: Page;
  userBPage: Page;
}

export const test = baseTest.extend<CustomTestFixtures>({
  baseURL: async ({}, use, testInfo) => {
    const url = `http://127.0.0.1:300${testInfo.parallelIndex}`;
    process.env.BETTER_AUTH_URL = url;
    await use(url);
  },
  userAContext: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    await use(context);
    await context.close();
  },
  userBContext: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    await use(context);
    await context.close();
  },
  userAPage: async ({ userAContext }, use) => {
    const page = await userAContext.newPage();
    await use(page);
    await page.close();
  },
  userBPage: async ({ userBContext }, use) => {
    const page = await userBContext.newPage();
    await use(page);
    await page.close();
  },
});

test.afterEach(async () => {
  await cleanupTestData();
});

export { expect };
