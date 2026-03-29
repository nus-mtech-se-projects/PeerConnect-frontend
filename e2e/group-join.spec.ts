import { test, expect } from '@playwright/test';
import { authenticate, setupPreviewAndGoto, clickAndConfirm, mockRoute, createGroupData, GROUP_ID } from './helpers/group-fixtures';

const MOCK_GROUP = createGroupData({
  members: [
    { userId: '99999999-9999-9999-9999-999999999999', firstName: 'Owner', lastName: 'User', email: 'owner@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
  ],
});

test.describe('Join Group', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('shows group preview with Join button for non-member', async ({ page }) => {
    await setupPreviewAndGoto(page, MOCK_GROUP);
    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    await expect(page.getByRole('button', { name: /join this group/i })).toBeVisible();
  });

  test('joins group successfully and shows toast', async ({ page }) => {
    await setupPreviewAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/join`, 'POST', 200, { message: 'Joined group' });
    await clickAndConfirm(page, page.getByRole('button', { name: /join this group/i }), 'Join');
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('shows error toast when join fails', async ({ page }) => {
    await setupPreviewAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/join`, 'POST', 400, { error: 'Group is full' });
    await clickAndConfirm(page, page.getByRole('button', { name: /join this group/i }), 'Join');
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });
});
