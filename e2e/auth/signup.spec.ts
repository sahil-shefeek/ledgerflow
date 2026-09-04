import { test, expect, generateTestPrefix, globalTestDataTracker } from '../helpers/test-fixtures';
import { db } from '@/db';
import { user } from '@/db/schema/auth';
import { eq } from 'drizzle-orm';

test.describe('03 — Signup & Registration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        // Toggle to signup view
        await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    });

    test('should render mandatory fields', async ({ page }) => {
        await expect(page.getByText(/Create an Account/i)).toBeVisible();
        await expect(page.getByLabel(/^Email$/i)).toBeVisible();
        await expect(page.getByLabel(/^Password$/i)).toBeVisible();
        await expect(page.getByLabel(/Confirm Password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
    });

    test('should show inline validation messages for invalid inputs', async ({ page }) => {
        const passwordItem = page.locator('[data-slot="form-item"]').filter({ has: page.getByLabel(/^Password$/i) });
        const confirmPasswordItem = page.locator('[data-slot="form-item"]').filter({ has: page.getByLabel(/Confirm Password/i) });

        // Try submitting empty
        await page.getByRole('button', { name: /Create Account/i }).click();

        // Check for inline validation messages
        await expect(page.getByText('Please enter a valid email address')).toBeVisible();
        await expect(passwordItem.getByText('Password must be at least 6 characters')).toBeVisible();
        await expect(confirmPasswordItem.getByText('Password must be at least 6 characters')).toBeVisible();

        // Try submitting invalid formats
        await page.getByLabel(/^Email$/i).fill('invalid-email');
        await page.getByLabel(/^Password$/i).fill('12345'); // < 6 characters
        await page.getByLabel(/Confirm Password/i).fill('123456'); // >= 6 characters, triggers mismatch refinement

        await page.getByRole('button', { name: /Create Account/i }).click();

        await expect(page.getByText('Please enter a valid email address')).toBeVisible();
        await expect(passwordItem.getByText('Password must be at least 6 characters')).toBeVisible();
        await expect(confirmPasswordItem.getByText("Passwords don't match")).toBeVisible();
    });

    test('should successfully register and initialize user profile', async ({ page }) => {
        const prefix = generateTestPrefix('signup');
        const testEmail = `${prefix}@example.com`;
        const testPassword = 'SecurePassword123!';

        await page.getByLabel(/^Email$/i).fill(testEmail);
        await page.getByLabel(/^Password$/i).fill(testPassword);
        await page.getByLabel(/Confirm Password/i).fill(testPassword);

        // Submit form
        await page.getByRole('button', { name: /Create Account/i }).click();

        // Verify success toast
        await expect(page.getByText('Account created successfully!')).toBeVisible();

        // Verify redirect to onboarding (dashboard layout redirects new users to onboarding)
        await expect(page).toHaveURL(/\/onboarding/);

        // Verify user was created in DB
        const users = await db.select().from(user).where(eq(user.email, testEmail));
        expect(users.length).toBe(1);

        // Add to tracker for cleanup
        globalTestDataTracker.userIds.add(users[0].id);
    });
});
