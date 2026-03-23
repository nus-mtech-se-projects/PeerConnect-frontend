import { test, expect } from '@playwright/test';
import { authenticate, setupGroupPreviewMocks, createGroupData, GROUP_ID } from './helpers/group-fixtures';

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
    await setupGroupPreviewMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    await expect(page.getByRole('button', { name: /join this group/i })).toBeVisible();
  });

  test('joins group successfully when no approval required (mocked)', async ({ page }) => {
    await setupGroupPreviewMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/join`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Joined group' }) })
    );
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('shows pending message when approval is required (mocked)', async ({ page }) => {
    const groupWithApproval = { ...MOCK_GROUP, approvalRequired: true };
    await setupGroupPreviewMocks(page, groupWithApproval);
    await page.route(`**/api/groups/${GROUP_ID}/join`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Join request submitted' }) })
    );
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.locator('.dashToast')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when group is full (mocked)', async ({ page }) => {
    await setupGroupPreviewMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/join`, (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Group is full' }) })
    );
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when already a member (mocked)', async ({ page }) => {
    await setupGroupPreviewMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/join`, (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Already a member' }) })
    );
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  test('join button shows loading state while joining', async ({ page }) => {
    await setupGroupPreviewMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/join`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Joined group' }) });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.getByRole('button', { name: /joining/i })).toBeVisible({ timeout: 3000 });
  });
});
