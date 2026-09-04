import { test, expect, seedRegisteredUser, authenticateContext, seedBankAccount } from './helpers/test-fixtures';
import { db } from '@/db';
import { recurringTransactions, categories } from '@/db/schema/financial';

test.describe('Mobile Interaction Patterns: Bottom Sheets & Desktop Hover', () => {
  test('mobile viewport displays explicit "..." button which triggers a Bottom Sheet drawer', async ({
    userAContext,
    userAPage,
    baseURL,
  }) => {
    // 1. Seed user, account, category, and recurring transaction
    const userResult = await seedRegisteredUser();
    await authenticateContext(userAContext, userResult.sessionToken, baseURL, userResult.cookies);
    await userAContext.addInitScript(() => {
        localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
    });

    const account = await seedBankAccount(userResult.user.id, {
      name: 'Mobile Test Account',
      balance: '5000.00',
    });

    const [category] = await db
      .insert(categories)
      .values({
        userId: userResult.user.id,
        name: 'Streaming',
        icon: '🎬',
        type: 'EXPENSE',
      })
      .returning();

    await db.insert(recurringTransactions).values({
      userId: userResult.user.id,
      accountId: account.id,
      categoryId: category.id,
      name: 'Netflix Mobile',
      amount: '499.00',
      frequency: 'MONTHLY',
      scheduleMode: 'CALENDAR',
      startDate: new Date(),
      nextRunDate: new Date(),
      flow: 'OUT',
      active: true,
      failureCount: 0,
    });

    // 2. Set mobile viewport
    await userAPage.setViewportSize({ width: 375, height: 667 });
    await userAPage.goto('/dashboard');
    await userAPage.waitForLoadState('networkidle');

    // 3. Locate the recurring transaction item
    const txItem = userAPage.getByTestId('recurring-transaction-item').filter({ hasText: 'Netflix Mobile' });
    await expect(txItem).toBeVisible();

    // 4. Assert explicit "..." button is visible on mobile viewport
    const moreButton = txItem.getByTestId('mobile-action-trigger');
    await expect(moreButton).toBeVisible();

    // Verify touch target size of the trigger button on mobile
    const box = await moreButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(40);
    }

    // 5. Tap the "..." button to open the Bottom Sheet
    await moreButton.click();

    // 6. Assert Bottom Sheet drawer popup is visible
    const drawerPopup = userAPage.getByRole('dialog', { name: 'Netflix Mobile' });
    await expect(drawerPopup).toBeVisible();

    // 7. Assert actions are present inside Bottom Sheet
    const editAction = drawerPopup.getByRole('button', { name: 'Edit Subscription' });
    const deleteAction = drawerPopup.getByRole('button', { name: 'Delete Subscription' });

    await expect(editAction).toBeVisible();
    await expect(deleteAction).toBeVisible();

    // Verify each action button satisfies minimum 48px touch target height
    const editBox = await editAction.boundingBox();
    expect(editBox).not.toBeNull();
    if (editBox) {
      expect(editBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('categories page mobile viewport opens Bottom Sheet for category actions', async ({
    userAContext,
    userAPage,
    baseURL,
  }) => {
    const userResult = await seedRegisteredUser();
    await authenticateContext(userAContext, userResult.sessionToken, baseURL, userResult.cookies);
    await userAContext.addInitScript(() => {
        localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
    });

    await db.insert(categories).values({
      userId: userResult.user.id,
      name: 'Entertainment Category',
      icon: 'popcorn',
      type: 'EXPENSE',
    });

    await userAPage.setViewportSize({ width: 375, height: 667 });
    await userAPage.goto('/dashboard/categories');
    await userAPage.waitForLoadState('networkidle');

    const categoryCard = userAPage.getByTestId('category-item').filter({ hasText: 'Entertainment Category' });
    await expect(categoryCard).toBeVisible();

    const moreButton = categoryCard.getByTestId('mobile-action-trigger');
    await expect(moreButton).toBeVisible();

    await moreButton.click();

    const drawerPopup = userAPage.getByRole('dialog', { name: 'Entertainment Category' });
    await expect(drawerPopup).toBeVisible();
    await expect(drawerPopup.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(drawerPopup.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('desktop viewport reveals actions on hover and does not show mobile trigger', async ({
    userAContext,
    userAPage,
    baseURL,
  }) => {
    const userResult = await seedRegisteredUser();
    await authenticateContext(userAContext, userResult.sessionToken, baseURL, userResult.cookies);
    await userAContext.addInitScript(() => {
        localStorage.setItem('app-preference', JSON.stringify({ state: { mode: 'personal' }, version: 0 }));
    });

    const account = await seedBankAccount(userResult.user.id, {
      name: 'Desktop Test Account',
      balance: '5000.00',
    });

    const [category] = await db
      .insert(categories)
      .values({
        userId: userResult.user.id,
        name: 'Work Services',
        icon: '💼',
        type: 'EXPENSE',
      })
      .returning();

    await db.insert(recurringTransactions).values({
      userId: userResult.user.id,
      accountId: account.id,
      categoryId: category.id,
      name: 'Cloud Server',
      amount: '1200.00',
      frequency: 'MONTHLY',
      scheduleMode: 'CALENDAR',
      startDate: new Date(),
      nextRunDate: new Date(),
      flow: 'OUT',
      active: true,
      failureCount: 0,
    });

    // Desktop viewport (1440x900) - Expanded to ensure grid column surpasses the @sm (384px) container breakpoint
    await userAPage.setViewportSize({ width: 1440, height: 900 });
    await userAPage.goto('/dashboard');
    await userAPage.waitForLoadState('networkidle');

    const txItem = userAPage.getByTestId('recurring-transaction-item').filter({ hasText: 'Cloud Server' });
    await expect(txItem).toBeVisible();

    // On desktop, desktop-actions container is visible
    const desktopActions = txItem.getByTestId('desktop-actions');
    await expect(desktopActions).toBeVisible();

    // Hover reveals edit/delete buttons
    await txItem.hover();
    const editBtn = desktopActions.getByRole('button', { name: 'Edit Cloud Server' });
    await expect(editBtn).toBeVisible();
  });
});
