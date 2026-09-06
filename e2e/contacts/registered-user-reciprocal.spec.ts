import { type Page, type BrowserContext } from '@playwright/test';
import {
    test,
    expect,
    seedRegisteredUser,
    authenticateContext,
    seedBankAccount,
    ensurePersonalDashboard,
    seedFriendship,
    type SeededUserResult
} from '../helpers/test-fixtures';

async function createPersonalTransaction(page: Page, options: { type: 'Expense' | 'Income', amount: string, name: string, contactName: string, category: string }) {
    const addBtn = page.getByTestId('fab-add-transaction');
    await addBtn.click();

    const addDialog = page.getByTestId('personal-transaction-drawer');
    await expect(addDialog).toBeVisible();

    await addDialog.getByRole('tab', { name: new RegExp(options.type, 'i') }).click();
    await addDialog.getByLabel(/Amount/i).fill(options.amount);
    await addDialog.getByLabel(/^Name/i).fill(options.name);

    const personSelectTrigger = addDialog.getByRole('combobox');
    await personSelectTrigger.click();
    await page.getByRole('option', { name: options.contactName }).click();

    await addDialog.getByRole('button', { name: options.category }).click();
    await addDialog.getByRole('button', { name: /Save Transaction/i }).click();
    await expect(page.getByText('Transaction saved')).toBeVisible();
}

async function initPersonalMode(context: BrowserContext) {
    await context.addInitScript(() => {
        localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
    });
}

test.describe('Registered 2-User Reciprocal Flow', () => {
    let userA: SeededUserResult;
    let userB: SeededUserResult;

    test.beforeEach(async () => {
        userA = await seedRegisteredUser({ name: 'Alice', email: 'alice@example.com' });
        userB = await seedRegisteredUser({ name: 'Bob', email: 'bob@example.com' });

        await seedBankAccount(userA.user.id);
        await seedBankAccount(userB.user.id);

        await seedFriendship(userA.user.id, userB.user.id, 'ACCEPTED');
    });

    test('1:1 split transactions sync across reciprocal friends', async ({ userAPage, userAContext, userBPage, userBContext, baseURL }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await authenticateContext(userBContext, userB.sessionToken, baseURL, userB.cookies);

        await initPersonalMode(userAContext);
        await initPersonalMode(userBContext);

        await userAPage.goto('/dashboard');
        await ensurePersonalDashboard(userAPage);

        await createPersonalTransaction(userAPage, {
            type: 'Expense',
            amount: '1000',
            name: 'Dinner at Central',
            contactName: 'Bob',
            category: 'Food'
        });

        await userAPage.goto('/dashboard/friends');
        const userAFriendsTab = userAPage.getByRole('tabpanel');
        await expect(userAFriendsTab.getByText('Bob')).toBeVisible();
        await expect(userAFriendsTab.getByText('₹1,000', { exact: true })).toBeVisible();
        
        await userAFriendsTab.getByText('Bob').click();
        await expect(userAPage.getByText('You will get')).toBeVisible();
        await expect(userAPage.getByText('₹1,000', { exact: true })).toBeVisible();
        await expect(userAPage.getByText('Dinner at Central')).toBeVisible();
        
        await userBPage.goto('/dashboard/friends');
        const userBFriendsTab = userBPage.getByRole('tabpanel');
        await expect(userBFriendsTab.getByText('Alice')).toBeVisible();
        await expect(userBFriendsTab.getByText('₹1,000', { exact: true })).toBeVisible(); 
        
        await userBFriendsTab.getByText('Alice').click();
        await expect(userBPage.getByText('You will give')).toBeVisible();
        await expect(userBPage.getByText('₹1,000', { exact: true })).toBeVisible();
        await expect(userBPage.getByText('Dinner at Central')).toBeVisible();

        // 4. User B views the transaction but cannot edit it
        await userBPage.getByText('Dinner at Central').click();
        
        const userBDetailsDrawer = userBPage.getByTestId('transaction-details-drawer');
        await expect(userBDetailsDrawer).toBeVisible();
        await expect(userBDetailsDrawer.getByText('Created by Alice. Cannot be modified.')).toBeVisible();
        await userBPage.keyboard.press('Escape'); // Close drawer
        await expect(userBDetailsDrawer).toBeHidden();

        // 5. User B settles the transaction by paying Alice back
        await userBPage.goto('/dashboard');
        await ensurePersonalDashboard(userBPage);

        // Since B owes A, B records an expense paid to A. Wait, if B pays A, B's money goes out.
        await createPersonalTransaction(userBPage, {
            type: 'Expense',
            amount: '1000',
            name: 'Settling up',
            contactName: 'Alice',
            category: 'Food'
        });
        
        // B should see "Settled" on friends page
        await userBPage.goto('/dashboard/friends');
        await expect(userBPage.getByText('Settled', { exact: true })).toBeVisible();
        
        // 6. User A reloads and sees reactive update
        await userAPage.goto('/dashboard/friends');
        await expect(userAPage.getByText('Settled', { exact: true })).toBeVisible();
    });
});
