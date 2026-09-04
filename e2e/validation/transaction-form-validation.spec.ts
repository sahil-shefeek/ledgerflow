import { test, expect, seedRegisteredUser, authenticateContext, seedBankAccount } from '../helpers/test-fixtures';

test.describe('Transaction Form Validation & Polish', () => {
    test.setTimeout(60000);
    test('transaction form shows user-friendly validation errors', async ({ userAPage, userAContext, baseURL }) => {
        const { sessionToken, user, cookies } = await seedRegisteredUser({ username: 'testuser_123' });
        await seedBankAccount(user.id, { name: 'Cash', balance: '1000' });
        
        await authenticateContext(userAContext, sessionToken, baseURL, cookies);
        await userAContext.addInitScript(() => {
            localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
        });
        await userAPage.goto('/dashboard');
        
        // Wait for page to be ready
        await expect(userAPage).toHaveURL(/\/dashboard/);
        // Open the transaction drawer (Personal Transaction Drawer)
        // Locate the button with fixed position
        const addButton = userAPage.getByTestId('fab-add-transaction');
        await expect(addButton).toBeVisible();
        await addButton.click();
        
        // Wait for Drawer
        await expect(userAPage.getByRole('dialog')).toBeVisible();
        
        // Click Save Transaction without filling anything
        await userAPage.getByRole('button', { name: 'Save Transaction' }).click();
        
        // Assert empty amount error
        await expect(userAPage.getByText('How much was this for?')).toBeVisible();
        
        // Assert missing title
        await expect(userAPage.getByText('What was this for? Please add a title')).toBeVisible();
        
        // Type negative amount
        await userAPage.getByLabel('Amount (₹)').fill('-50');
        await userAPage.getByRole('button', { name: 'Save Transaction' }).click();
        await expect(userAPage.getByText('Amount must be a positive number')).toBeVisible();
        
        // Fix amount and title
        await userAPage.getByLabel('Amount (₹)').fill('100');
        await userAPage.getByLabel('Name').fill('Groceries');
        
        // Try to save without selecting a category (for OUT flow which is default)
        await userAPage.getByRole('button', { name: 'Save Transaction' }).click();
        
        // Assert toast alert for category
        const toast = userAPage.locator('[data-slot="toast"]');
        await expect(toast).toBeVisible();
        await expect(toast).toContainText('Please pick a category for this expense');
    });
});
