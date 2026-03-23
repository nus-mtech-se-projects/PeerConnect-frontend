import { test, expect } from '@playwright/test';
import { authenticate, setupGroupMocks, createGroupData, GROUP_ID, OWNER_USER_ID, CURRENT_USER_ID } from './helpers/group-fixtures';

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
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    await expect(page.getByRole('button', { name: /leave this group/i })).toBeVisible();
  });

  test('leaves group successfully (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/leave`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Left group' }) })
    );
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /leave this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Leave' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when leave fails (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/leave`, (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Cannot leave as owner' }) })
    );
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /leave this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Leave' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  test('leave button shows loading state while leaving', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/leave`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Left group' }) });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /leave this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Leave' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.getByRole('button', { name: /leaving/i })).toBeVisible({ timeout: 3000 });
  });

  test('cancel leave confirmation keeps user in group', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /leave this group/i }).click();
    const cancelBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Cancel' });
    await expect(cancelBtn).toBeVisible({ timeout: 2000 });
    await cancelBtn.click();
    await expect(page.getByRole('button', { name: /leave this group/i })).toBeVisible();
  });
});
