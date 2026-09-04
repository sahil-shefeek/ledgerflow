import { test, expect } from '../helpers/test-fixtures';
import { seedRegisteredUser, seedBankAccount, authenticateContext } from '../helpers/test-fixtures';
import { db } from '@/db';
import { categories, transactions } from '@/db/schema/financial';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

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

        await userAPage.goto('/dashboard');

        // Wait for personal dashboard to be ready
        const personalHeading = userAPage.getByTestId('personal-heading');
        const switchBtn = userAPage.getByRole('button', { name: /Switch to Personal/i });
        await expect(personalHeading.or(switchBtn)).toBeVisible();

        if (await switchBtn.isVisible()) {
            await switchBtn.click();
        }
        await expect(personalHeading).toBeVisible();

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

        // Submit form
        await addDialog.getByRole('button', { name: /Save Transaction/i }).click();

        // Verify toast and drawer closing deterministically
        await expect(userAPage.getByText('Transaction saved')).toBeVisible();
        await expect(addDialog).toBeHidden();

        // Verify it appears in the list reactively
        await expect(recentTransactionsCard.getByText('Starbucks Coffee')).toBeVisible();
        await expect(recentTransactionsCard.getByText('Food & Dining')).toBeVisible();
        await expect(recentTransactionsCard.getByText('-₹450')).toBeVisible();

        // 2. Read / Edit
        await recentTransactionsCard.getByText('Starbucks Coffee').click();
        
        // Wait for details drawer
        const detailsDrawer = userAPage.getByTestId('transaction-details-drawer');
        await expect(detailsDrawer).toBeVisible();
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

        // 3. Delete
        await recentTransactionsCard.getByText('Starbucks Premium Coffee').click();
        
        // Wait for details drawer
        await expect(detailsDrawer).toBeVisible();
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
    });

    test('should create personal income transaction and display in recent transactions', async ({ userAPage, userAContext, baseURL }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });

        await userAPage.goto('/dashboard');

        const personalHeading = userAPage.getByTestId('personal-heading');
        const switchBtn = userAPage.getByRole('button', { name: /Switch to Personal/i });
        await expect(personalHeading.or(switchBtn)).toBeVisible();

        if (await switchBtn.isVisible()) {
            await switchBtn.click();
        }
        await expect(personalHeading).toBeVisible();

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
});
