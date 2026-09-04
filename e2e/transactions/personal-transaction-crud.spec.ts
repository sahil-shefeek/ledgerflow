import { test, expect } from '../helpers/test-fixtures';
import { seedRegisteredUser, seedBankAccount, authenticateContext } from '../helpers/test-fixtures';
import type { Page } from '@playwright/test';
import { db } from '@/db';
import { categories, transactions } from '@/db/schema/financial';
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

interface CreateTransactionUIOptions {
    flow: 'EXPENSE' | 'INCOME';
    amount: string;
    name: string;
    note?: string;
    categoryId?: string;
    accountId?: string;
    pickPreviousMonthDate?: boolean;
    time?: string;
}

async function createTransactionViaUI(page: Page, options: CreateTransactionUIOptions) {
    const addBtn = page.getByTestId('fab-add-transaction');
    await addBtn.click();

    const addDialog = page.locator('[data-testid="personal-transaction-drawer"][data-open]');
    await expect(addDialog).toBeVisible();

    if (options.flow === 'INCOME') {
        await addDialog.getByRole('tab', { name: /Income/i }).click();
    } else {
        await addDialog.getByRole('tab', { name: /Expense/i }).click();
    }

    await addDialog.locator('input[name="amount"]').fill(options.amount);

    if (options.flow === 'EXPENSE' && options.categoryId) {
        await addDialog.getByTestId(`category-${options.categoryId}`).click();
    }

    if (options.accountId) {
        await addDialog.getByTestId(`account-${options.accountId}`).click();
    }

    await addDialog.locator('input[name="name"]').fill(options.name);
    if (options.note) {
        await addDialog.locator('input[name="note"]').fill(options.note);
    }

    if (options.time || options.pickPreviousMonthDate) {
        const datePickerBtn = addDialog.getByTestId('date-picker-trigger');
        await datePickerBtn.click();

        if (options.pickPreviousMonthDate) {
            const prevButton = page.getByRole('button', { name: /Previous Month/i });
            await expect(prevButton).toBeVisible();
            await prevButton.click();

            const dayButton = page
                .getByRole('grid')
                .getByRole('button')
                .filter({ hasText: /^15$/ })
                .first();
            await expect(dayButton).toBeVisible();
            await dayButton.click();
        }

        if (options.time) {
            const timeInput = page.locator('input[type="time"]');
            await expect(timeInput).toBeVisible();
            await timeInput.fill(options.time);
        }

        await page.keyboard.press('Escape');
        await expect(page.locator('input[type="time"]')).toBeHidden();
        await expect(addDialog).toBeVisible();
    }

    await addDialog.getByRole('button', { name: /Save Transaction/i }).click();
    await expect(page.getByText('Transaction saved')).toBeVisible();
    await expect(addDialog).toBeHidden();
}

test.describe('Personal Transaction CRUD', () => {
    let userA: any;
    let categoryExpenseId: string;
    let categoryGroceriesId: string;
    let categoryIncomeId: string;
    let accountId: string;

    test.beforeEach(async () => {
        // Seed user and dependencies
        const seededUser = await seedRegisteredUser();
        userA = seededUser;

        const seededAccount = await seedBankAccount(userA.user.id, {
            name: 'Cash Wallet',
            type: 'CASH',
            balance: '500000', // paise = 5000.00 Rs
        });
        accountId = seededAccount.id;

        const expenseCat = await db.insert(categories).values({
            id: crypto.randomUUID(),
            userId: userA.user.id,
            name: 'Food & Dining',
            icon: 'hamburger',
            type: 'EXPENSE',
            active: true,
        }).returning();
        categoryExpenseId = expenseCat[0].id;

        const groceriesCat = await db.insert(categories).values({
            id: crypto.randomUUID(),
            userId: userA.user.id,
            name: 'Groceries & Essentials',
            icon: 'shopping-bag',
            type: 'EXPENSE',
            active: true,
        }).returning();
        categoryGroceriesId = groceriesCat[0].id;

        const incomeCat = await db.insert(categories).values({
            id: crypto.randomUUID(),
            userId: userA.user.id,
            name: 'Freelance Salary',
            icon: 'money-bag',
            type: 'INCOME',
            active: true,
        }).returning();
        categoryIncomeId = incomeCat[0].id;
    });

    test('should perform full CRUD operations on personal expense transaction', async ({ userAPage, userAContext, baseURL }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });

        await ensurePersonalDashboard(userAPage);

        const recentTransactionsCard = userAPage.getByTestId('personal-transactions-card');
        await expect(recentTransactionsCard).toBeVisible();

        // 1. Create a personal expense transaction
        const addBtn = userAPage.getByTestId('fab-add-transaction');
        await addBtn.click();

        const addDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(addDialog).toBeVisible();
        await expect(addDialog.getByRole('heading', { name: /Add Expense \/ Income/i })).toBeVisible();

        // Select Expense tab
        await addDialog.getByRole('tab', { name: /Expense/i }).click();

        // Fill out form
        await addDialog.locator('input[name="amount"]').fill('450'); // 450 INR
        
        // Select category
        const categoryBtn = addDialog.getByTestId(`category-${categoryExpenseId}`);
        await categoryBtn.click();
        
        // Select account
        const accountBtn = addDialog.getByTestId(`account-${accountId}`);
        await accountBtn.click();

        await addDialog.locator('input[name="name"]').fill('Starbucks Coffee');
        await addDialog.locator('input[name="note"]').fill('Morning coffee run');

        // Set date & time via DateTimePicker (exercising calendar date selection and time input)
        const datePickerBtn = addDialog.getByTestId('date-picker-trigger');
        await datePickerBtn.click();

        // Select today's date in calendar widget
        const todayButton = userAPage
            .getByRole('grid')
            .getByRole('button', { name: /Today/i });
        await expect(todayButton).toBeVisible();
        await todayButton.click();

        const timeInput = userAPage.locator('input[type="time"]');
        await expect(timeInput).toBeVisible();
        await timeInput.fill('14:30');
        // Close popover via Escape key
        await userAPage.keyboard.press('Escape');
        await expect(timeInput).toBeHidden();
        await expect(addDialog).toBeVisible();

        // Submit form
        await addDialog.getByRole('button', { name: /Save Transaction/i }).click();

        // Verify toast and drawer closing deterministically
        await expect(userAPage.getByText('Transaction saved')).toBeVisible();
        await expect(addDialog).toBeHidden();

        // Verify it appears in the list reactively
        await expect(recentTransactionsCard.getByText('Starbucks Coffee')).toBeVisible();
        await expect(recentTransactionsCard.getByText('Food & Dining')).toBeVisible();
        await expect(recentTransactionsCard.getByText('-₹450')).toBeVisible();

        // 2. Read details and Edit
        await recentTransactionsCard.getByText('Starbucks Coffee').click();
        
        // Wait for details drawer and verify all attributes (amount, category, note, date/time)
        const detailsDrawer = userAPage.getByTestId('transaction-details-drawer');
        await expect(detailsDrawer).toBeVisible();
        await expect(detailsDrawer.getByText('Starbucks Coffee')).toBeVisible();
        await expect(detailsDrawer.getByText('Morning coffee run')).toBeVisible();
        await expect(detailsDrawer.getByText('Food & Dining')).toBeVisible();
        await expect(detailsDrawer.getByText('-₹450')).toBeVisible();
        await expect(detailsDrawer.getByText('2:30 PM')).toBeVisible();
        await expect(detailsDrawer.getByTestId('edit-transaction-button')).toBeVisible();
        await detailsDrawer.getByTestId('edit-transaction-button').click();

        // Wait for details drawer to finish closing and edit drawer to open
        await expect(detailsDrawer).toBeHidden();

        const editDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(editDialog).toBeVisible();
        await expect(editDialog.getByRole('heading', { name: /Edit Transaction/i })).toBeVisible();

        // Edit amount, category, and name
        await editDialog.locator('input[name="amount"]').fill('550');
        await editDialog.locator('input[name="name"]').fill('Starbucks Premium Coffee');
        const newCategoryBtn = editDialog.getByTestId(`category-${categoryGroceriesId}`);
        await newCategoryBtn.click();

        // Save edit
        await editDialog.getByRole('button', { name: /Update Transaction/i }).click();

        await expect(userAPage.getByText('Transaction updated')).toBeVisible();
        await expect(editDialog).toBeHidden();

        // Verify the list is updated reactively
        await expect(recentTransactionsCard.getByText('Starbucks Premium Coffee')).toBeVisible();
        await expect(recentTransactionsCard.getByText('Groceries & Essentials')).toBeVisible();
        await expect(recentTransactionsCard.getByText('-₹550')).toBeVisible();

        // 3. Delete and verify soft deletion
        await recentTransactionsCard.getByText('Starbucks Premium Coffee').click();
        
        // Wait for details drawer and verify updated content
        await expect(detailsDrawer).toBeVisible();
        await expect(detailsDrawer.getByText('Starbucks Premium Coffee')).toBeVisible();
        await expect(detailsDrawer.getByText('Groceries & Essentials')).toBeVisible();
        await expect(detailsDrawer.getByText('-₹550')).toBeVisible();
        await expect(detailsDrawer.getByTestId('delete-transaction-button')).toBeVisible();
        await detailsDrawer.getByTestId('delete-transaction-button').click();
        
        await expect(userAPage.getByText('Transaction deleted')).toBeVisible();
        await expect(detailsDrawer).toBeHidden();

        // Verify it is removed from the list dynamically without page reload
        await expect(recentTransactionsCard.getByText('Starbucks Premium Coffee')).toBeHidden();

        // Verify soft deletion in database
        const dbTx = await db.query.transactions.findFirst({
            where: eq(transactions.userId, userA.user.id),
        });
        
        expect(dbTx).not.toBeNull();
        expect(dbTx?.deletedAt).not.toBeNull();
        expect(dbTx?.name).toBe('Starbucks Premium Coffee');
        expect(dbTx?.note).toBe('Morning coffee run');
    });

    test('should create personal income transaction and display in recent transactions', async ({ userAPage, userAContext, baseURL }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });

        await ensurePersonalDashboard(userAPage);

        const recentTransactionsCard = userAPage.getByTestId('personal-transactions-card');
        await expect(recentTransactionsCard).toBeVisible();

        // Click FAB to open transaction drawer
        const addBtn = userAPage.getByTestId('fab-add-transaction');
        await addBtn.click();

        const addDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(addDialog).toBeVisible();
        await expect(addDialog.getByRole('heading', { name: /Add Expense \/ Income/i })).toBeVisible();

        // Select Income tab
        await addDialog.getByRole('tab', { name: /Income/i }).click();

        // Fill out form
        await addDialog.locator('input[name="amount"]').fill('12000');
        
        const accountBtn = addDialog.getByTestId(`account-${accountId}`);
        await accountBtn.click();

        await addDialog.locator('input[name="name"]').fill('Client Consulting Retainer');
        await addDialog.locator('input[name="note"]').fill('September installment');

        // Submit form
        await addDialog.getByRole('button', { name: /Save Transaction/i }).click();

        await expect(userAPage.getByText('Transaction saved')).toBeVisible();
        await expect(addDialog).toBeHidden();

        // Verify it appears in the list with +₹ prefix in green
        await expect(recentTransactionsCard.getByText('Client Consulting Retainer')).toBeVisible();
        await expect(recentTransactionsCard.getByText('+₹12,000')).toBeVisible();
    });

    test('should read, filter and sort transactions created via UI dynamically without full page reload', async ({ userAPage, userAContext, baseURL }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });

        await ensurePersonalDashboard(userAPage);

        const recentTransactionsCard = userAPage.getByTestId('personal-transactions-card');
        await expect(recentTransactionsCard).toBeVisible();

        // 1. Create a past-month expense via UI (picking previous month date in calendar)
        await createTransactionViaUI(userAPage, {
            flow: 'EXPENSE',
            amount: '3000',
            categoryId: categoryExpenseId,
            accountId: accountId,
            name: 'Old Supermarket Run',
            note: 'Monthly groceries',
            pickPreviousMonthDate: true,
        });

        // 2. Create an income transaction today via UI
        await createTransactionViaUI(userAPage, {
            flow: 'INCOME',
            amount: '50000',
            accountId: accountId,
            name: 'Freelance Project',
            note: 'Web development retainer',
        });

        // 3. Create a recent small expense today via UI
        await createTransactionViaUI(userAPage, {
            flow: 'EXPENSE',
            amount: '250',
            categoryId: categoryGroceriesId,
            accountId: accountId,
            name: 'Morning Espresso',
            note: 'Quick cafe coffee',
        });

        // 4. Initial State: Default "All Time" filter displays all 3 transactions
        await expect(recentTransactionsCard.getByText('Old Supermarket Run')).toBeVisible();
        await expect(recentTransactionsCard.getByText('Freelance Project')).toBeVisible();
        await expect(recentTransactionsCard.getByText('Morning Espresso')).toBeVisible();

        const transactionItems = recentTransactionsCard.getByTestId('transaction-item');
        await expect(transactionItems).toHaveCount(3);

        // 5. Filter by Today: Past-month transaction is dynamically excluded without reload
        const timeFilterTrigger = recentTransactionsCard.getByTestId('transaction-time-filter');
        await timeFilterTrigger.click();
        await userAPage.locator('[data-slot="select-item"]').filter({ hasText: 'Today' }).click();

        await expect(recentTransactionsCard.getByText('Old Supermarket Run')).toBeHidden();
        await expect(recentTransactionsCard.getByText('Freelance Project')).toBeVisible();
        await expect(recentTransactionsCard.getByText('Morning Espresso')).toBeVisible();
        await expect(transactionItems).toHaveCount(2);

        // Switch back to "All Time" to verify reactive restoration
        await timeFilterTrigger.click();
        await userAPage.locator('[data-slot="select-item"]').filter({ hasText: 'All Time' }).click();
        await expect(recentTransactionsCard.getByText('Old Supermarket Run')).toBeVisible();
        await expect(transactionItems).toHaveCount(3);

        // 6. Sort by Highest Amount
        const sortTrigger = recentTransactionsCard.getByTestId('transaction-sort-filter');
        await sortTrigger.click();
        await userAPage.locator('[data-slot="select-item"]').filter({ hasText: 'Highest Amount' }).click();

        // Verify dynamic reordering: Freelance Project (50k) -> Old Supermarket Run (3k) -> Morning Espresso (250)
        await expect(transactionItems.nth(0)).toContainText('Freelance Project');
        await expect(transactionItems.nth(1)).toContainText('Old Supermarket Run');
        await expect(transactionItems.nth(2)).toContainText('Morning Espresso');

        // 7. Sort by Lowest Amount
        await sortTrigger.click();
        await userAPage.locator('[data-slot="select-item"]').filter({ hasText: 'Lowest Amount' }).click();

        // Verify dynamic reordering: Morning Espresso (250) -> Old Supermarket Run (3k) -> Freelance Project (50k)
        await expect(transactionItems.nth(0)).toContainText('Morning Espresso');
        await expect(transactionItems.nth(1)).toContainText('Old Supermarket Run');
        await expect(transactionItems.nth(2)).toContainText('Freelance Project');
    });
});
