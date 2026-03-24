import { test, expect } from '@playwright/test';
import { authenticate, setupAndGoto, clickAndConfirm, mockRoute, createGroupData, GROUP_ID, OWNER_USER_ID, CURRENT_USER_ID } from './helpers/group-fixtures';

const MOCK_GROUP = createGroupData({
  isAdmin: false,
  members: [
    { userId: OWNER_USER_ID, firstName: 'Owner', lastName: 'User', email: 'owner@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
    { userId: CURRENT_USER_ID, firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu', role: 'member', membershipStatus: 'approved' },
  ],
});

test.describe('Leave Group', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('shows Leave button for a group member', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    await expect(page.getByRole('button', { name: /leave this group/i })).toBeVisible();
  });

  test('leaves group successfully', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/leave`, 'POST', 200, { message: 'Left group' });
    await clickAndConfirm(page, page.getByRole('button', { name: /leave this group/i }), 'Leave');
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when leave fails', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/leave`, 'POST', 400, { error: 'Cannot leave as owner' });
    await clickAndConfirm(page, page.getByRole('button', { name: /leave this group/i }), 'Leave');
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });
});
