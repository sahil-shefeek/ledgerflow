import { test, expect } from '../helpers/test-fixtures';
import { seedRegisteredUser, seedBankAccount, authenticateContext } from '../helpers/test-fixtures';
import type { Page } from '@playwright/test';
import { db } from '@/db';
import { categories, accounts, transactions } from '@/db/schema/financial';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

async function ensurePersonalDashboard(page: Page) {
    await page.goto('/dashboard');
    const personalHeading = page.getByTestId('personal-heading');
    const switchBtn = page.getByRole('button', { name: /Switch to Personal/i });
    await expect(personalHeading.or(switchBtn)).toBeVisible();

    if (await switchBtn.isVisible()) {
        await switchBtn.click();
    }
    await expect(personalHeading).toBeVisible();
}

test.describe('Bank & Account Balance Updates', () => {
    let userA: Awaited<ReturnType<typeof seedRegisteredUser>>;
    let bankAccountId: string;
    let cashAccountId: string;
    let expenseCategoryId: string;

    test.beforeEach(async () => {
        userA = await seedRegisteredUser();

        // 1. Record initial bank account balance in test fixture: 1,000,000 paise = ₹10,000.00
        const seededBank = await seedBankAccount(userA.user.id, {
            name: 'HDFC Salary Bank',
            type: 'BANK',
            balance: '1000000',
        });
        bankAccountId = seededBank.id;

        // 2. Record initial cash account balance in test fixture: 500,000 paise = ₹5,000.00
        const seededCash = await seedBankAccount(userA.user.id, {
            name: 'Pocket Cash Wallet',
            type: 'CASH',
            balance: '500000',
        });
        cashAccountId = seededCash.id;

        const [cat] = await db.insert(categories).values({
            id: crypto.randomUUID(),
            userId: userA.user.id,
            name: 'Office Supplies',
            icon: 'briefcase',
            type: 'EXPENSE',
            active: true,
        }).returning();
        expenseCategoryId = cat.id;
    });

    test('should accurately decrement bank account balance on expense creation, recalculate on edit, and revert on delete', async ({
        userAPage,
        userAContext,
        baseURL,
    }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });

        await ensurePersonalDashboard(userAPage);

        const accountsCard = userAPage.getByTestId('accounts-card');
        await expect(accountsCard).toBeVisible();

        const bankAccountItem = accountsCard.getByTestId('account-item').filter({ hasText: 'HDFC Salary Bank' });
        await expect(bankAccountItem).toBeVisible();

        // 1. Initial State: Bank account has initial balance ₹10,000
        await expect(bankAccountItem.getByTestId('account-balance')).toContainText('₹10,000');

        // 2. Create Expense: ₹1,500 assigned to Bank Account
        const addBtn = userAPage.getByTestId('fab-add-transaction');
        await addBtn.click();

        const addDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(addDialog).toBeVisible();
        await expect(addDialog.getByRole('heading', { name: /Add Expense \/ Income/i })).toBeVisible();

        await addDialog.getByRole('tab', { name: /Expense/i }).click();
        await addDialog.locator('input[name="amount"]').fill('1500');

        await addDialog.getByTestId(`category-${expenseCategoryId}`).click();
        await addDialog.getByTestId(`account-${bankAccountId}`).click();

        await addDialog.locator('input[name="name"]').fill('Ergonomic Office Chair');
        await addDialog.locator('input[name="note"]').fill('Desk setup upgrade');

        await addDialog.getByRole('button', { name: /Save Transaction/i }).click();

        await expect(userAPage.getByText('Transaction saved')).toBeVisible();
        await expect(addDialog).toBeHidden();

        // Assert bank account balance decrements accurately: ₹10,000 - ₹1,500 = ₹8,500
        await expect(bankAccountItem.getByTestId('account-balance')).toContainText('₹8,500');

        // Assert transaction item appears in recent transactions with negative amount
        const recentTransactionsCard = userAPage.getByTestId('personal-transactions-card');
        await expect(recentTransactionsCard.getByText('Ergonomic Office Chair')).toBeVisible();
        await expect(recentTransactionsCard.getByText('-₹1,500')).toBeVisible();

        // Assert DB integer paise consistency: 1,000,000 - 150,000 = 850,000 paise
        let dbBank = await db.query.accounts.findFirst({
            where: eq(accounts.id, bankAccountId),
        });
        expect(Number(dbBank?.balance)).toBe(850000);

        // 3. Edit Expense: Change amount from ₹1,500 to ₹2,200
        await recentTransactionsCard.getByText('Ergonomic Office Chair').click();

        const detailsDrawer = userAPage.getByTestId('transaction-details-drawer');
        await expect(detailsDrawer).toBeVisible();
        await expect(detailsDrawer.getByText('-₹1,500')).toBeVisible();
        await expect(detailsDrawer.getByText('HDFC Salary Bank')).toBeVisible();
        await expect(detailsDrawer.getByText('Desk setup upgrade')).toBeVisible();

        await detailsDrawer.getByTestId('edit-transaction-button').click();
        await expect(detailsDrawer).toBeHidden();

        const editDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(editDialog).toBeVisible();
        await expect(editDialog.getByRole('heading', { name: /Edit Transaction/i })).toBeVisible();

        // Fill updated amount and note
        await editDialog.locator('input[name="amount"]').fill('2200');
        await editDialog.locator('input[name="name"]').fill('Ergonomic Office Chair Pro');

        await editDialog.getByRole('button', { name: /Update Transaction/i }).click();

        await expect(userAPage.getByText('Transaction updated')).toBeVisible();
        await expect(editDialog).toBeHidden();

        // Assert bank account balance recalculates accurately: ₹10,000 - ₹2,200 = ₹7,800
        await expect(bankAccountItem.getByTestId('account-balance')).toContainText('₹7,800');

        // Assert transaction item updates in recent transactions
        await expect(recentTransactionsCard.getByText('Ergonomic Office Chair Pro')).toBeVisible();
        await expect(recentTransactionsCard.getByText('-₹2,200')).toBeVisible();

        // Assert DB integer paise consistency: 1,000,000 - 220,000 = 780,000 paise
        dbBank = await db.query.accounts.findFirst({
            where: eq(accounts.id, bankAccountId),
        });
        expect(Number(dbBank?.balance)).toBe(780000);

        // 4. Delete Expense: Assert bank account balance reverts to initial amount (₹10,000)
        await recentTransactionsCard.getByText('Ergonomic Office Chair Pro').click();
        await expect(detailsDrawer).toBeVisible();
        await expect(detailsDrawer.getByText('-₹2,200')).toBeVisible();

        await detailsDrawer.getByTestId('delete-transaction-button').click();

        await expect(userAPage.getByText('Transaction deleted')).toBeVisible();
        await expect(detailsDrawer).toBeHidden();

        // Assert bank account balance reverts accurately: ₹7,800 + ₹2,200 = ₹10,000
        await expect(bankAccountItem.getByTestId('account-balance')).toContainText('₹10,000');
        await expect(recentTransactionsCard.getByText('Ergonomic Office Chair Pro')).toBeHidden();

        // Assert DB integer paise consistency: reverted to 1,000,000 paise
        dbBank = await db.query.accounts.findFirst({
            where: eq(accounts.id, bankAccountId),
        });
        expect(Number(dbBank?.balance)).toBe(1000000);

        // Assert transaction is soft-deleted in DB
        const deletedDbTx = await db.query.transactions.findFirst({
            where: eq(transactions.userId, userA.user.id),
        });
        expect(deletedDbTx?.deletedAt).not.toBeNull();
    });

    test('should accurately increment cash account balance on personal income creation, recalculate on edit, and revert on delete', async ({
        userAPage,
        userAContext,
        baseURL,
    }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });

        await ensurePersonalDashboard(userAPage);

        const accountsCard = userAPage.getByTestId('accounts-card');
        await expect(accountsCard).toBeVisible();

        const cashAccountItem = accountsCard.getByTestId('account-item').filter({ hasText: 'Pocket Cash Wallet' });
        await expect(cashAccountItem).toBeVisible();

        // 1. Initial State: Cash Wallet has initial balance ₹5,000
        await expect(cashAccountItem.getByTestId('account-balance')).toContainText('₹5,000');

        // 2. Create Income: ₹3,000 assigned to Cash Wallet
        const addBtn = userAPage.getByTestId('fab-add-transaction');
        await addBtn.click();

        const addDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(addDialog).toBeVisible();
        await expect(addDialog.getByRole('heading', { name: /Add Expense \/ Income/i })).toBeVisible();

        await addDialog.getByRole('tab', { name: /Income/i }).click();
        await addDialog.locator('input[name="amount"]').fill('3000');

        await addDialog.getByTestId(`account-${cashAccountId}`).click();

        await addDialog.locator('input[name="name"]').fill('Client Cash Tip');
        await addDialog.locator('input[name="note"]').fill('Bonus payout');

        await addDialog.getByRole('button', { name: /Save Transaction/i }).click();

        await expect(userAPage.getByText('Transaction saved')).toBeVisible();
        await expect(addDialog).toBeHidden();

        // Assert Cash Wallet balance increments accurately: ₹5,000 + ₹3,000 = ₹8,000
        await expect(cashAccountItem.getByTestId('account-balance')).toContainText('₹8,000');

        // Assert transaction item appears in recent transactions with positive amount
        const recentTransactionsCard = userAPage.getByTestId('personal-transactions-card');
        await expect(recentTransactionsCard.getByText('Client Cash Tip')).toBeVisible();
        await expect(recentTransactionsCard.getByText('+₹3,000')).toBeVisible();

        // Assert DB integer paise consistency: 500,000 + 300,000 = 800,000 paise
        let dbCash = await db.query.accounts.findFirst({
            where: eq(accounts.id, cashAccountId),
        });
        expect(Number(dbCash?.balance)).toBe(800000);

        // 3. Edit Income: Change amount from ₹3,000 to ₹4,500
        await recentTransactionsCard.getByText('Client Cash Tip').click();

        const detailsDrawer = userAPage.getByTestId('transaction-details-drawer');
        await expect(detailsDrawer).toBeVisible();
        await expect(detailsDrawer.getByText('+₹3,000')).toBeVisible();

        await detailsDrawer.getByTestId('edit-transaction-button').click();
        await expect(detailsDrawer).toBeHidden();

        const editDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(editDialog).toBeVisible();

        await editDialog.locator('input[name="amount"]').fill('4500');
        await editDialog.locator('input[name="name"]').fill('Client Cash Tip Revised');

        await editDialog.getByRole('button', { name: /Update Transaction/i }).click();

        await expect(userAPage.getByText('Transaction updated')).toBeVisible();
        await expect(editDialog).toBeHidden();

        // Assert Cash Wallet balance recalculates accurately: ₹5,000 + ₹4,500 = ₹9,500
        await expect(cashAccountItem.getByTestId('account-balance')).toContainText('₹9,500');
        await expect(recentTransactionsCard.getByText('Client Cash Tip Revised')).toBeVisible();
        await expect(recentTransactionsCard.getByText('+₹4,500')).toBeVisible();

        // Assert DB integer paise consistency: 500,000 + 450,000 = 950,000 paise
        dbCash = await db.query.accounts.findFirst({
            where: eq(accounts.id, cashAccountId),
        });
        expect(Number(dbCash?.balance)).toBe(950000);

        // 4. Delete Income: Assert cash account balance reverts to initial amount (₹5,000)
        await recentTransactionsCard.getByText('Client Cash Tip Revised').click();
        await expect(detailsDrawer).toBeVisible();

        await detailsDrawer.getByTestId('delete-transaction-button').click();

        await expect(userAPage.getByText('Transaction deleted')).toBeVisible();
        await expect(detailsDrawer).toBeHidden();

        // Assert Cash Wallet balance reverts accurately: ₹9,500 - ₹4,500 = ₹5,000
        await expect(cashAccountItem.getByTestId('account-balance')).toContainText('₹5,000');
        await expect(recentTransactionsCard.getByText('Client Cash Tip Revised')).toBeHidden();

        // Assert DB integer paise consistency: reverted to 500,000 paise
        dbCash = await db.query.accounts.findFirst({
            where: eq(accounts.id, cashAccountId),
        });
        expect(Number(dbCash?.balance)).toBe(500000);
    });

    test('should accurately update both accounts when transferring an expense between bank and cash accounts during edit', async ({
        userAPage,
        userAContext,
        baseURL,
    }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });

        await ensurePersonalDashboard(userAPage);

        const accountsCard = userAPage.getByTestId('accounts-card');
        await expect(accountsCard).toBeVisible();

        const bankAccountItem = accountsCard.getByTestId('account-item').filter({ hasText: 'HDFC Salary Bank' });
        const cashAccountItem = accountsCard.getByTestId('account-item').filter({ hasText: 'Pocket Cash Wallet' });

        // Initial balances: Bank = ₹10,000, Cash = ₹5,000
        await expect(bankAccountItem.getByTestId('account-balance')).toContainText('₹10,000');
        await expect(cashAccountItem.getByTestId('account-balance')).toContainText('₹5,000');

        // 1. Create Expense assigned to Bank: ₹2,000
        const addBtn = userAPage.getByTestId('fab-add-transaction');
        await addBtn.click();

        const addDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(addDialog).toBeVisible();

        await addDialog.getByRole('tab', { name: /Expense/i }).click();
        await addDialog.locator('input[name="amount"]').fill('2000');
        await addDialog.getByTestId(`category-${expenseCategoryId}`).click();
        await addDialog.getByTestId(`account-${bankAccountId}`).click();
        await addDialog.locator('input[name="name"]').fill('Hardware Monitor');

        await addDialog.getByRole('button', { name: /Save Transaction/i }).click();
        await expect(userAPage.getByText('Transaction saved')).toBeVisible();
        await expect(addDialog).toBeHidden();

        // Bank decrements: ₹10,000 - ₹2,000 = ₹8,000; Cash remains ₹5,000
        await expect(bankAccountItem.getByTestId('account-balance')).toContainText('₹8,000');
        await expect(cashAccountItem.getByTestId('account-balance')).toContainText('₹5,000');

        // Verify DB balances
        let dbBank = await db.query.accounts.findFirst({ where: eq(accounts.id, bankAccountId) });
        let dbCash = await db.query.accounts.findFirst({ where: eq(accounts.id, cashAccountId) });
        expect(Number(dbBank?.balance)).toBe(800000);
        expect(Number(dbCash?.balance)).toBe(500000);

        // 2. Edit transaction: Switch account from Bank to Cash Wallet, and change amount to ₹2,500
        const recentTransactionsCard = userAPage.getByTestId('personal-transactions-card');
        await recentTransactionsCard.getByText('Hardware Monitor').click();

        const detailsDrawer = userAPage.getByTestId('transaction-details-drawer');
        await expect(detailsDrawer).toBeVisible();
        await detailsDrawer.getByTestId('edit-transaction-button').click();
        await expect(detailsDrawer).toBeHidden();

        const editDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(editDialog).toBeVisible();

        // Switch to Cash Wallet
        await editDialog.getByTestId(`account-${cashAccountId}`).click();
        await editDialog.locator('input[name="amount"]').fill('2500');
        await editDialog.locator('input[name="name"]').fill('Hardware Monitor 4K');

        await editDialog.getByRole('button', { name: /Update Transaction/i }).click();
        await expect(userAPage.getByText('Transaction updated')).toBeVisible();
        await expect(editDialog).toBeHidden();

        // Bank balance reverts to initial: ₹10,000
        // Cash Wallet decrements by new amount: ₹5,000 - ₹2,500 = ₹2,500
        await expect(bankAccountItem.getByTestId('account-balance')).toContainText('₹10,000');
        await expect(cashAccountItem.getByTestId('account-balance')).toContainText('₹2,500');

        // Verify DB balances after account switch
        dbBank = await db.query.accounts.findFirst({ where: eq(accounts.id, bankAccountId) });
        dbCash = await db.query.accounts.findFirst({ where: eq(accounts.id, cashAccountId) });
        expect(Number(dbBank?.balance)).toBe(1000000);
        expect(Number(dbCash?.balance)).toBe(250000);

        // 3. Delete transaction: Cash Wallet balance reverts back to ₹5,000; Bank remains ₹10,000
        await recentTransactionsCard.getByText('Hardware Monitor 4K').click();
        await expect(detailsDrawer).toBeVisible();
        await detailsDrawer.getByTestId('delete-transaction-button').click();
        await expect(userAPage.getByText('Transaction deleted')).toBeVisible();
        await expect(detailsDrawer).toBeHidden();

        await expect(bankAccountItem.getByTestId('account-balance')).toContainText('₹10,000');
        await expect(cashAccountItem.getByTestId('account-balance')).toContainText('₹5,000');

        dbBank = await db.query.accounts.findFirst({ where: eq(accounts.id, bankAccountId) });
        dbCash = await db.query.accounts.findFirst({ where: eq(accounts.id, cashAccountId) });
        expect(Number(dbBank?.balance)).toBe(1000000);
        expect(Number(dbCash?.balance)).toBe(500000);
    });
});
