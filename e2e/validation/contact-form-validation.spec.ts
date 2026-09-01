import { test, expect } from '../helpers/test-fixtures';
import { seedRegisteredUser, authenticateContext } from '../helpers/test-fixtures';

test.describe('Contact Form Validation', () => {
    test('should show validation errors and add a contact successfully', async ({ userAPage, userAContext, baseURL }) => {
        const userA = await seedRegisteredUser();
        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);

        await userAPage.goto('/dashboard/friends');

        // Click "Add New" button
        await userAPage.getByRole('button', { name: 'Add New' }).click();

        // 1. Test missing name
        await userAPage.getByRole('button', { name: 'Add Person', exact: true }).click();
        await expect(userAPage.getByText('Please enter a name.')).toBeVisible();

        // 2. Test invalid phone number
        await userAPage.getByLabel('Name').fill('John Doe');
        await userAPage.getByLabel('Phone (Optional)').fill('invalid-phone');
        await userAPage.getByRole('button', { name: 'Add Person', exact: true }).click();
        await expect(userAPage.getByText('Please enter a valid phone number (e.g., +919876543210).')).toBeVisible();

        // 3. Add successfully
        await userAPage.getByLabel('Phone (Optional)').fill('+1234567890');
        await userAPage.getByRole('button', { name: 'Add Person', exact: true }).click();
        
        // Drawer should close and toast should appear
        await expect(userAPage.getByText('Person added')).toBeVisible();
        await expect(userAPage.getByText('John Doe')).toBeVisible();

        // Wait for drawer to close fully
        await expect(userAPage.getByText('Add New Person')).not.toBeVisible();

        // 4. Test duplicate entry
        await userAPage.getByRole('button', { name: 'Add New' }).click();
        await userAPage.getByLabel('Name').fill('John Doe');
        await userAPage.getByRole('button', { name: 'Add Person', exact: true }).click();
        await expect(userAPage.getByText('You already have a person named "John Doe" in your friends list.')).toBeVisible();
    });
});
