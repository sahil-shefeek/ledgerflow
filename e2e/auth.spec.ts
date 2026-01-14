import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should render login page correctly', async ({ page }) => {
        await page.goto('/login');

        // Check for title or main heading
        await expect(page.getByText(/Welcome to LedgerFlow/i)).toBeVisible();

        // Check for phone input
        await expect(page.getByPlaceholder('9999999999')).toBeVisible();
        await expect(page.getByRole('button', { name: /Send OTP/i })).toBeVisible();
    });

    test('should allow user to login with phone and OTP', async ({ page }) => {
        await page.goto('/login');

        // Fill phone number
        await page.getByPlaceholder('9999999999').fill('9999999999');

        // Click Send OTP
        await page.getByRole('button', { name: /Send OTP/i }).click();

        // Wait for OTP input to appear
        await expect(page.getByText(/Enter the OTP sent to/i)).toBeVisible();

        // Fill OTP (InputOTP usually splits input, keeping it simple by typing sequentially if possible or just filling)
        // The shadcn InputOTP component might need sequential key presses or a fill on the hidden input if accessible.
        // Usually 'fill' on the first visible input or typing works.
        // Let's try typing `123456` which often works with OTP inputs.
        await page.locator('input[autocomplete="one-time-code"]').fill('123456');

        // Click Verify OTP
        await page.getByRole('button', { name: /Verify OTP/i }).click();

        // Expect redirection to dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Expect dashboard content
        // Adjust this text expectation based on actual dashboard content if "Dashboard" isn't explicitly visible
        // But the prompt asked for "Dashboard" or "Overview".
        // Let's wait for a common dashboard element.
        // Given the previous context, maybe there is a visible header.
        // I'll stick to the URL check as primary and a text check as secondary.
        await expect(page.locator('body')).toContainText(/Dashboard|Overview/i);
    });
});
