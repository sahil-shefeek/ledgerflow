import { test, expect } from './helpers/test-fixtures';

test.describe('Authentication Flow', () => {
    test('should render login page correctly with email and Google options', async ({ page }) => {
        await page.goto('/login');

        // Check for title
        await expect(page.getByText(/Welcome to LedgerFlow/i)).toBeVisible();

        // Check for Google OAuth button
        await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();

        // Check for Email & Password inputs
        await expect(page.getByPlaceholder('m@example.com')).toBeVisible();
        await expect(page.getByPlaceholder('••••••••')).toBeVisible();
        await expect(page.getByRole('button', { name: /^Sign In$/i })).toBeVisible();
    });

    test('should toggle to sign up mode', async ({ page }) => {
        await page.goto('/login');

        // Click Sign Up button
        await page.getByRole('button', { name: /Sign Up/i }).click();

        // Check for Sign Up elements
        await expect(page.getByText(/Create an Account/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
    });

    test('should redirect unauthenticated request to /dashboard to /login', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    });

    test('should redirect request with forged session cookie from /dashboard to /login', async ({ page, context }) => {
        await context.addCookies([
            {
                name: 'better-auth.session_token',
                value: 'forged_invalid_session_token_123',
                domain: 'localhost',
                path: '/',
            },
        ]);
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    });
});
