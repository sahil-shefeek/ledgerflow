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

        await seedBankAccount(userA.user.id, { balance: '5000.00' });
        await seedBankAccount(userB.user.id, { balance: '5000.00' });

        await seedFriendship(userA.user.id, userB.user.id, 'ACCEPTED');
    });

    test('1:1 split transactions sync across reciprocal friends', async ({ userAPage, userAContext, userBPage, userBContext, baseURL }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await authenticateContext(userBContext, userB.sessionToken, baseURL, userB.cookies);

        await initPersonalMode(userAContext);
        await initPersonalMode(userBContext);

        // 1. Both users start on personal dashboard
        await userAPage.goto('/dashboard');
        await ensurePersonalDashboard(userAPage);

        await userBPage.goto('/dashboard');
        await ensurePersonalDashboard(userBPage);

        // 2. User A opens Bob details and splits a ₹1,000 expense equally
        await userAPage.goto('/dashboard/friends');
        const userAFriendsTab = userAPage.getByRole('tabpanel');
        await expect(userAFriendsTab.getByText('Bob')).toBeVisible();
        await userAFriendsTab.getByText('Bob').click();

        await expect(userAPage.getByTestId('split-expense-button')).toBeVisible();
        await userAPage.getByTestId('split-expense-button').click();

        const splitDrawer = userAPage.getByTestId('split-expense-drawer');
        await expect(splitDrawer).toBeVisible();

        // Step 1: Enter amount & name
        await userAPage.getByLabel('Enter amount').fill('1000');
        await userAPage.getByPlaceholder("What's this for?").fill('Dinner at Central');
        await userAPage.getByTestId('split-expense-next-button').click();

        // Step 2: Confirm split configuration and submit
        await expect(userAPage.getByRole('heading', { name: 'Split Expense' })).toBeVisible();
        await userAPage.getByTestId('split-expense-submit-button').click();
        await expect(userAPage.getByText('Expense added!')).toBeVisible();
        await expect(splitDrawer).toBeHidden();

        // 3. Assert User A's balances across Friend Details, Friends Tab, and Dashboard
        // (a) Friend Details
        await expect(userAPage.getByText('You will get')).toBeVisible();
        await expect(userAPage.getByText('₹500', { exact: true })).toBeVisible();
        await expect(userAPage.getByText('Dinner at Central')).toBeVisible();

        // (b) Friends Tab
        await userAPage.goto('/dashboard/friends');
        const userAFriendsList = userAPage.getByRole('tabpanel');
        await expect(userAFriendsList.getByText('Bob')).toBeVisible();
        await expect(userAFriendsList.getByText('₹500', { exact: true })).toBeVisible();
        await expect(userAFriendsList.getByText('You will get')).toBeVisible();

        // (c) Dashboard SharedBalancesCard
        await userAPage.goto('/dashboard');
        await expect(userAPage.getByText('Get back').locator('..').getByText('₹500')).toBeVisible();
        await expect(userAPage.getByText('Owes you ₹500')).toBeVisible();

        // Leave User A viewing Bob's details page for subsequent live sync assertion
        await userAPage.goto('/dashboard/friends');
        await userAPage.getByRole('tabpanel').getByText('Bob').click();
        await expect(userAPage.getByText('You will get')).toBeVisible();

        // 4. Switch to User B window live via window focus
        await userBPage.bringToFront();
        await userBPage.evaluate(() => {
            window.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('focus'));
        });

        // (a) User B Dashboard SharedBalancesCard live updates to You owe: ₹500
        await expect(userBPage.getByText('You owe').locator('..').getByText('₹500').first()).toBeVisible();
        await expect(userBPage.getByText('You owe ₹500')).toBeVisible();

        // (b) User B Friends Tab shows Alice: ₹500 and You will give
        await userBPage.getByRole('button', { name: 'Manage People' }).click();
        const userBFriendsList = userBPage.getByRole('tabpanel');
        await expect(userBFriendsList.getByText('Alice')).toBeVisible();
        await expect(userBFriendsList.getByText('₹500', { exact: true })).toBeVisible();
        await expect(userBFriendsList.getByText('You will give')).toBeVisible();

        // (c) User B Friend Details shows ₹500 and Dinner at Central
        await userBFriendsList.getByText('Alice').click();
        await expect(userBPage.getByText('You will give')).toBeVisible();
        await expect(userBPage.getByText('₹500', { exact: true })).toBeVisible();
        await expect(userBPage.getByText('Dinner at Central')).toBeVisible();

        // 5. User B inspects the shared transaction details
        await userBPage.getByText('Dinner at Central').click();
        const userBDetailsDrawer = userBPage.getByTestId('transaction-details-drawer');
        await expect(userBDetailsDrawer).toBeVisible();
        await expect(userBDetailsDrawer.getByText('Created by Alice. Cannot be modified.')).toBeVisible();
        await expect(userBDetailsDrawer.getByText('Alice', { exact: true })).toBeVisible();
        await expect(userBDetailsDrawer.getByText('Bob', { exact: true })).toBeVisible();
        await expect(userBDetailsDrawer.getByText('₹500', { exact: true }).first()).toBeVisible();
        await userBPage.keyboard.press('Escape');
        await expect(userBDetailsDrawer).toBeHidden();

        // 6. User B settles the balance using dedicated SettleUpDrawer
        await expect(userBPage.getByTestId('settle-up-button')).toBeVisible();
        await userBPage.getByTestId('settle-up-button').click();

        const settleDrawer = userBPage.getByTestId('settle-up-drawer');
        await expect(settleDrawer).toBeVisible();
        await expect(userBPage.getByTestId('settle-up-amount-input')).toHaveValue('500');

        await userBPage.getByTestId('settle-up-submit-button').click();
        await expect(userBPage.getByText('Settlement recorded!')).toBeVisible();
        await expect(settleDrawer).toBeHidden();

        // User B sees Settled / ₹0
        await expect(userBPage.getByText('Settled', { exact: true })).toBeVisible();
        await expect(userBPage.getByText('₹0', { exact: true })).toBeVisible();

        // 7. Live Multi-Window Sync on User A (WITHOUT reload or navigation)
        await userAPage.bringToFront();
        await userAPage.evaluate(() => {
            window.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('focus'));
        });

        // User A was on Bob's friend details page and reactively sees Settled / ₹0
        await expect(userAPage.getByText('Settled', { exact: true })).toBeVisible();
        await expect(userAPage.getByText('₹0', { exact: true })).toBeVisible();
        await expect(userAPage.getByText('Settlement')).toBeVisible();
    });
});
