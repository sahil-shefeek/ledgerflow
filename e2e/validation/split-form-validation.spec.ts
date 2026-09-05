import { test, expect, seedRegisteredUser, authenticateContext, seedBankAccount, seedGroupLedger } from '../helpers/test-fixtures';
import type { Page, BrowserContext } from '@playwright/test';

interface SeededGroupContext {
    userA: Awaited<ReturnType<typeof seedRegisteredUser>>;
    userB: Awaited<ReturnType<typeof seedRegisteredUser>>;
    group: { id: string; name: string };
}

async function setupGroupTest(
    page: Page,
    context: BrowserContext,
    baseURL?: string
): Promise<SeededGroupContext> {
    const userA = await seedRegisteredUser({ name: 'User A', username: 'userA_' + Date.now() });
    const userB = await seedRegisteredUser({ name: 'User B', username: 'userB_' + Date.now() });

    await seedBankAccount(userA.user.id, { name: 'Cash', balance: '1000' });

    const { group } = await seedGroupLedger(userA.user.id, {
        name: 'Trip Group',
        memberUserIds: [userB.user.id],
    });

    await authenticateContext(context, userA.sessionToken, baseURL, userA.cookies);

    await page.goto(`/dashboard/groups/${group.id}`);
    await expect(page.getByText('Trip Group')).toBeVisible({ timeout: 15000 });

    return { userA, userB, group };
}

async function openSplitExpenseDrawer(page: Page, amount = '100', name = 'Dinner') {
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible();

    await page.getByLabel('Enter amount').fill(amount);
    await page.getByPlaceholder("What's this for?").fill(name);

    await expect(page.getByRole('combobox')).toContainText('Cash');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Split Expense' })).toBeVisible();
}

test.describe('Split Form Validation', () => {
    test('validates step 1 inputs for zero, negative amounts and required description', async ({ userAPage: page, userAContext, baseURL }) => {
        await setupGroupTest(page, userAContext, baseURL);

        await page.getByRole('button', { name: 'Add Expense' }).click();
        await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible();

        const amountInput = page.getByLabel('Enter amount');
        const descriptionInput = page.getByPlaceholder("What's this for?");
        const nextButton = page.getByRole('button', { name: 'Next' });

        await expect(page.getByRole('combobox')).toContainText('Cash');

        // 1. Negative amount
        await amountInput.fill('-50');
        await descriptionInput.fill('Dinner');
        await nextButton.click();
        await expect(page.getByText('Please enter a valid amount').first()).toBeVisible();

        // 2. Zero amount
        await amountInput.fill('0');
        await nextButton.click();
        await expect(page.getByText('Please enter a valid amount').first()).toBeVisible();

        // 3. Empty description
        await amountInput.fill('100');
        await descriptionInput.fill('');
        await nextButton.click();
        await expect(page.getByText('Please enter a description').first()).toBeVisible();

        // 4. Valid inputs advance to step 2
        await descriptionInput.fill('Dinner');
        await nextButton.click();
        await expect(page.getByRole('heading', { name: 'Split Expense' })).toBeVisible();
    });

    test('validates split by amount: asserts warnings and toast when custom amounts do not sum to total or are negative', async ({ userAPage: page, userAContext, baseURL }) => {
        const { userB } = await setupGroupTest(page, userAContext, baseURL);
        await openSplitExpenseDrawer(page, '100', 'Dinner');

        // Switch to BY_AMOUNT tab
        await page.getByRole('tab', { name: /exact amounts/i }).click();
        await expect(page.getByText('Enter exact amounts')).toBeVisible();

        const userAAmount = page.getByLabel('Amount for You');
        const userBAmount = page.getByLabel(`Amount for ${userB.user.name}`);
        const submitButton = page.getByRole('button', { name: 'Send Request' });

        // Case A: Custom amounts sum to less than total (60 + 30 = 90 < 100)
        await userAAmount.fill('60');
        await userBAmount.fill('30');
        await expect(page.getByText('Remaining: ₹10.00')).toBeVisible();
        await submitButton.click();
        await expect(page.getByText('Custom amounts must sum to the total expense amount').first()).toBeVisible();

        // Case B: Custom amounts sum to more than total (60 + 50 = 110 > 100)
        await userBAmount.fill('50');
        await expect(page.getByText('Remaining: -₹10.00')).toBeVisible();
        await submitButton.click();
        await expect(page.getByText('Custom amounts must sum to the total expense amount').first()).toBeVisible();

        // Case C: Negative custom amount (110 + -10 = 100)
        await userAAmount.fill('110');
        await userBAmount.fill('-10');
        await submitButton.click();
        await expect(page.getByText('Split amounts cannot be negative').first()).toBeVisible();

        // Case D: Valid custom amounts matching total (60 + 40 = 100)
        await userAAmount.fill('60');
        await userBAmount.fill('40');
        await expect(page.getByText('Amounts match total')).toBeVisible();
    });

    test('validates split by percentage: asserts warnings and toast when percentages do not equal 100% or are negative', async ({ userAPage: page, userAContext, baseURL }) => {
        const { userB } = await setupGroupTest(page, userAContext, baseURL);
        await openSplitExpenseDrawer(page, '100', 'Dinner');

        // Switch to BY_PERCENTAGE tab
        await page.getByRole('tab', { name: /percentage/i }).click();
        await expect(page.getByText('Enter percentages')).toBeVisible();

        const userAPercent = page.getByLabel('Percentage for You');
        const userBPercent = page.getByLabel(`Percentage for ${userB.user.name}`);
        const submitButton = page.getByRole('button', { name: 'Send Request' });

        // Case A: Percentages sum to less than 100% (40 + 50 = 90%)
        await userAPercent.fill('40');
        await userBPercent.fill('50');
        await expect(page.getByText('Total: 90.00%')).toBeVisible();
        await submitButton.click();
        await expect(page.getByText('Percentages must add up to exactly 100%').first()).toBeVisible();

        // Case B: Percentages sum to more than 100% (60 + 50 = 110%)
        await userAPercent.fill('60');
        await userBPercent.fill('50');
        await expect(page.getByText('Total: 110.00%')).toBeVisible();
        await submitButton.click();
        await expect(page.getByText('Percentages must add up to exactly 100%').first()).toBeVisible();

        // Case C: Negative percentage (110% + -10% = 100%)
        await userAPercent.fill('110');
        await userBPercent.fill('-10');
        await submitButton.click();
        await expect(page.getByText('Split amounts cannot be negative').first()).toBeVisible();

        // Case D: Valid percentages (60% + 40% = 100%)
        await userAPercent.fill('60');
        await userBPercent.fill('40');
        await expect(page.getByText('Total 100%')).toBeVisible();
    });

    test('validates equal split requires at least one member selected', async ({ userAPage: page, userAContext, baseURL }) => {
        const { userB } = await setupGroupTest(page, userAContext, baseURL);
        await openSplitExpenseDrawer(page, '100', 'Dinner');

        // Tab is EQUALLY by default
        await expect(page.getByText('Split equally among selected members')).toBeVisible();

        const userACheckbox = page.getByRole('checkbox', { name: 'Select You' });
        const userBCheckbox = page.getByRole('checkbox', { name: `Select ${userB.user.name}` });
        const submitButton = page.getByRole('button', { name: 'Send Request' });

        // Both are checked by default
        await expect(userACheckbox).toBeChecked();
        await expect(userBCheckbox).toBeChecked();

        // Uncheck all members
        await userACheckbox.uncheck();
        await userBCheckbox.uncheck();

        await submitButton.click();
        await expect(page.getByText('You must select at least one member to split equally').first()).toBeVisible();
    });

    test('allows 0-value split edge case and submits expense successfully', async ({ userAPage: page, userAContext, baseURL }) => {
        const { userB } = await setupGroupTest(page, userAContext, baseURL);
        await openSplitExpenseDrawer(page, '100', 'Dinner');

        // Switch to BY_AMOUNT tab
        await page.getByRole('tab', { name: /exact amounts/i }).click();
        await expect(page.getByText('Enter exact amounts')).toBeVisible();

        const userAAmount = page.getByLabel('Amount for You');
        const userBAmount = page.getByLabel(`Amount for ${userB.user.name}`);
        const submitButton = page.getByRole('button', { name: 'Send Request' });

        // Edge case: User A takes 100, User B takes 0
        await userAAmount.fill('100');
        await userBAmount.fill('0');
        await expect(page.getByText('Amounts match total')).toBeVisible();

        // Submit form and verify success toast feedback
        await submitButton.click();
        await expect(page.getByText('Expense added!')).toBeVisible();
    });
});
