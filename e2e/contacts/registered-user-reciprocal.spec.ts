import { test, expect } from '../helpers/test-fixtures';
import { seedRegisteredUser, seedUnregisteredContact, authenticateContext, seedBankAccount } from '../helpers/test-fixtures';
import { db } from '@/db';
import { friendships } from '@/db/schema/social';
import crypto from 'crypto';

async function ensurePersonalDashboard(page: any) {
    const personalHeading = page.getByTestId('personal-heading');
    const switchBtn = page.getByRole('button', { name: /Switch to Personal/i });
    await expect(personalHeading.or(switchBtn)).toBeVisible();

    if (await switchBtn.isVisible()) {
        await switchBtn.click();
    }
    await expect(personalHeading).toBeVisible();
}

test.describe('Registered 2-User Reciprocal Flow', () => {
    let userA: any;
    let userB: any;
    let contactForB: any;
    let contactForA: any;

    test.beforeEach(async () => {
        userA = await seedRegisteredUser({ name: 'Alice', email: 'alice@example.com' });
        userB = await seedRegisteredUser({ name: 'Bob', email: 'bob@example.com' });

        await seedBankAccount(userA.user.id);
        await seedBankAccount(userB.user.id);

        await db.insert(friendships).values({
            id: crypto.randomUUID(),
            userId1: userA.user.id,
            userId2: userB.user.id,
            status: 'ACCEPTED',
            initiatorId: userA.user.id
        });

        contactForB = await seedUnregisteredContact(userA.user.id, {
            name: 'Bob',
            linkedUserId: userB.user.id
        });

        contactForA = await seedUnregisteredContact(userB.user.id, {
            name: 'Alice',
            linkedUserId: userA.user.id
        });
    });

    test('1:1 split transactions sync across reciprocal friends', async ({ userAPage, userAContext, userBPage, userBContext, baseURL }) => {
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);
        await authenticateContext(userBContext, userB.sessionToken, baseURL, userB.cookies);

        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });
        await userBContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });

        await userAPage.goto('/dashboard');
        await ensurePersonalDashboard(userAPage);

        const addBtn = userAPage.getByTestId('fab-add-transaction');
        await addBtn.click();

        const addDialog = userAPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(addDialog).toBeVisible();

        await addDialog.getByRole('tab', { name: /Expense/i }).click();
        await addDialog.locator('input[name="amount"]').fill('1000');
        await addDialog.locator('input[name="name"]').fill('Dinner at Central');

        const personSelectTrigger = addDialog.locator('button:has-text("Select person")');
        await personSelectTrigger.click();
        await userAPage.getByRole('option', { name: 'Bob' }).click();

        await addDialog.getByRole('button', { name: 'Food' }).click();
        await addDialog.getByRole('button', { name: /Save Transaction/i }).click();
        await expect(userAPage.getByText('Transaction saved')).toBeVisible();

        await userAPage.goto('/dashboard/friends');
        await expect(userAPage.getByText('Bob')).toBeVisible();
        await expect(userAPage.getByText('₹1,000', { exact: true })).toBeVisible();
        
        await userAPage.getByText('Bob').first().click();
        await expect(userAPage.getByText('You will get')).toBeVisible();
        await expect(userAPage.getByText('₹1,000', { exact: true })).toBeVisible();
        await expect(userAPage.getByText('Dinner at Central')).toBeVisible();
        
        await userBPage.goto('/dashboard/friends');
        await expect(userBPage.getByText('Alice')).toBeVisible();
        await expect(userBPage.getByText('₹1,000', { exact: true })).toBeVisible(); 
        
        await userBPage.getByText('Alice').first().click();
        await expect(userBPage.getByText('You will give')).toBeVisible();
        await expect(userBPage.getByText('₹1,000', { exact: true })).toBeVisible();
        await expect(userBPage.getByText('Dinner at Central')).toBeVisible();

        // 4. User B views the transaction but cannot edit it
        await userBPage.getByText('Dinner at Central').click();
        
        const bDetailsDrawer = userBPage.getByTestId('transaction-details-drawer');
        await expect(bDetailsDrawer).toBeVisible();
        await expect(bDetailsDrawer.getByText('Created by Alice. Cannot be modified.')).toBeVisible();
        await userBPage.keyboard.press('Escape'); // Close drawer
        await expect(bDetailsDrawer).toBeHidden();

        // 5. User B settles the transaction by paying Alice back
        await userBPage.goto('/dashboard');
        await ensurePersonalDashboard(userBPage);

        const bAddBtn = userBPage.getByTestId('fab-add-transaction');
        await bAddBtn.click();
        
        const bAddDialog = userBPage.locator('[data-testid="personal-transaction-drawer"][data-open]');
        await expect(bAddDialog).toBeVisible();
        
        // Since B owes A, B records an expense paid to A. Wait, if B pays A, B's money goes out.
        await bAddDialog.getByRole('tab', { name: /Expense/i }).click();
        await bAddDialog.locator('input[name="amount"]').fill('1000');
        await bAddDialog.locator('input[name="name"]').fill('Settling up');
        
        const bPersonSelectTrigger = bAddDialog.locator('button:has-text("Select person")');
        await bPersonSelectTrigger.click();
        await userBPage.getByRole('option', { name: 'Alice' }).click();
        
        await bAddDialog.getByRole('button', { name: 'Food' }).click();
        await bAddDialog.getByRole('button', { name: /Save Transaction/i }).click();
        await expect(userBPage.getByText('Transaction saved')).toBeVisible();
        
        // B should see "Settled" on friends page
        await userBPage.goto('/dashboard/friends');
        await expect(userBPage.getByText('Settled', { exact: true })).toBeVisible();
        
        // 6. User A reloads and sees reactive update
        await userAPage.goto('/dashboard/friends');
        await expect(userAPage.getByText('Settled', { exact: true })).toBeVisible();
    });
});
