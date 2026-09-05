import { test, expect } from '../helpers/test-fixtures';
import { seedRegisteredUser, authenticateContext } from '../helpers/test-fixtures';

test.describe('Group Form Validation', () => {
    test('should show validation errors for empty group name and invalid ghost names', async ({ userAPage, userAContext, baseURL }) => {
        const userA = await seedRegisteredUser();
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);

        await userAPage.goto('/dashboard/friends');

        // Click the Groups tab
        await userAPage.getByRole('tab', { name: 'Groups' }).click();

        // Wait for page to load
        await expect(userAPage.getByText('No Groups Yet')).toBeVisible();

        // Click "Create Group" to open drawer
        await userAPage.getByRole('button', { name: 'Create Group' }).first().click();

        // Verify Drawer is open
        await expect(userAPage.getByText('Create New Group')).toBeVisible();

        // Submit empty form (drawer submit button)
        await userAPage.getByTestId('create-group-submit').click();
        
        // Assert empty name error
        await expect(userAPage.getByText('Group name cannot be empty')).toBeVisible();

        // Fill valid name
        await userAPage.getByLabel('Group Name').fill('Goa Trip');

        // Add a ghost member with invalid name (e.g. 51+ chars)
        const longName = 'A'.repeat(51);
        await userAPage.getByPlaceholder('Add person without account...').fill(longName);
        await userAPage.getByRole('button', { name: 'Add person' }).click(); 

        // Submit form
        await userAPage.getByTestId('create-group-submit').click();

        // Assert invalid ghost name error (from Zod on server)
        const toast = userAPage.locator('[data-slot="toast"]');
        await expect(toast).toBeVisible();
        await expect(toast).toContainText('Member name is too long');
    });
});
