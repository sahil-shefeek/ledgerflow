import { test, expect, seedRegisteredUser, authenticateContext, seedBankAccount, seedGroupLedger } from '../helpers/test-fixtures';

test.describe('Split Form Validation', () => {
    test('validates custom amounts and percentages', async ({ userAPage: page, userAContext, baseURL }) => {
        // 1. Setup users and group
        const userA = await seedRegisteredUser({ username: 'userA_' + Date.now() });
        const userB = await seedRegisteredUser({ username: 'userB_' + Date.now() });
        
        await seedBankAccount(userA.user.id, { name: 'Cash', balance: '1000' });
        
        const { group } = await seedGroupLedger(userA.user.id, {
            name: 'Trip Group',
            memberUserIds: [userB.user.id],
        });

        await authenticateContext(userAContext, userA.sessionToken, baseURL, userA.cookies);

        // 2. Navigate to group page
        await page.goto(`/dashboard/groups/${group.id}`);

        // Wait for page to be ready
        await expect(page.getByText('Trip Group')).toBeVisible({ timeout: 15000 });

        // 3. Open SplitExpenseDrawer
        await page.getByRole('button', { name: 'Add Expense' }).click();
        await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible();

        // 4. Test step 1 validation (negative/zero amount)
        await page.getByRole('spinbutton').first().fill('-50'); // Negative amount
        await page.getByPlaceholder("What's this for?").fill('Dinner'); // Expense Name
        
        // Wait for account to be auto-selected or at least fetched
        await expect(page.getByRole('combobox')).toContainText('Cash');
        
        await page.getByRole('button', { name: 'Next' }).click();
        await expect(page.getByText('Please enter a valid amount').first()).toBeVisible();
        
        await page.getByRole('spinbutton').first().fill('0'); // Zero amount
        await page.getByRole('button', { name: 'Next' }).click();
        await expect(page.getByText('Please enter a valid amount').first()).toBeVisible();

        // Fill in valid amount to proceed
        await page.getByRole('spinbutton').first().fill('100');
        await page.getByRole('button', { name: 'Next' }).click();

        // Wait for step 2 to open
        await expect(page.getByRole('heading', { name: 'Split Expense' })).toBeVisible();
        await expect(page.getByRole('tablist')).toBeVisible();

        // 5. Test BY_AMOUNT (Exact amounts) validation
        await page.getByRole('tab', { name: '1.23' }).click();
        await expect(page.getByText('Enter exact amounts')).toBeVisible();

        // Find the input for user A and user B. There should be two number inputs.
        const numberInputs = page.getByRole('spinbutton');
        await expect(numberInputs).toHaveCount(2);

        // Enter amounts that don't sum to 100
        await numberInputs.nth(0).fill('60');
        await numberInputs.nth(1).fill('30');
        
        await page.getByRole('button', { name: 'Send Request' }).click();
        await expect(page.getByText('Custom amounts must sum to the total expense amount').first()).toBeVisible();

        // Test negative amounts
        await numberInputs.nth(0).fill('110');
        await numberInputs.nth(1).fill('-10');
        await page.getByRole('button', { name: 'Send Request' }).click();
        await expect(page.getByText('Split amounts cannot be negative').first()).toBeVisible();

        // Enter valid amounts to verify it works
        await numberInputs.nth(0).fill('60');
        await numberInputs.nth(1).fill('40');
        await expect(page.getByText('Amounts match total')).toBeVisible();

        // 6. Test BY_PERCENTAGE validation
        await page.getByRole('tab', { name: '%' }).click();
        await expect(page.getByText('Enter percentages')).toBeVisible();

        // Find the inputs again (should be 2)
        const percentInputs = page.getByRole('spinbutton');
        await expect(percentInputs).toHaveCount(2);

        // Enter percentages that don't sum to 100
        await percentInputs.nth(0).fill('40');
        await percentInputs.nth(1).fill('50');
        
        await page.getByRole('button', { name: 'Send Request' }).click();
        await expect(page.getByText('Percentages must add up to exactly 100%').first()).toBeVisible();

        // Test negative percentage
        await percentInputs.nth(0).fill('110');
        await percentInputs.nth(1).fill('-10');
        await page.getByRole('button', { name: 'Send Request' }).click();
        await expect(page.getByText('Split amounts cannot be negative').first()).toBeVisible();

        // Enter valid percentages
        await percentInputs.nth(0).fill('60');
        await percentInputs.nth(1).fill('40');
        await expect(page.getByText('Total 100%')).toBeVisible();

        // 7. Test EQUALLY validation (no members selected)
        await page.getByRole('tab', { name: '=' }).click();
        
        const checkboxes = page.getByRole('checkbox');
        await expect(checkboxes).toHaveCount(2);
        
        // Uncheck all selected members
        await checkboxes.nth(0).uncheck();
        await checkboxes.nth(1).uncheck();

        await page.getByRole('button', { name: 'Send Request' }).click();
        await expect(page.getByText('You must select at least one member to split equally').first()).toBeVisible();

        // 8. Test 0-value split edge case (Submit form)
        await page.getByRole('tab', { name: '1.23' }).click(); // Go back to BY_AMOUNT
        await numberInputs.nth(0).fill('100');
        await numberInputs.nth(1).fill('0');
        await expect(page.getByText('Amounts match total')).toBeVisible();
        
        await page.getByRole('button', { name: 'Send Request' }).click();
        await expect(page.getByText('Expense added!')).toBeVisible();
    });
});
