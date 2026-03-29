import { test, expect } from '@playwright/test';
import {
  authenticate,
  setupAndGoto,
  mockRoute,
  createGroupData,
  GROUP_ID,
  OWNER_USER_ID,
  MEMBER_USER_ID,
} from './helpers/group-fixtures';

const MOCK_GROUP = createGroupData({
  isAdmin: true,
  members: [
    { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'Owner', email: 'owner@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
    { userId: MEMBER_USER_ID, firstName: 'Alice', lastName: 'Tan', email: 'alice@u.nus.edu', role: 'member', membershipStatus: 'approved' },
  ],
});

test.describe('Transfer Ownership', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('shows approved members in transfer dropdown', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    const dropdown = page.locator('select.gdInput').filter({ hasText: /select approved member/i });
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('option', { hasText: 'Alice Tan' })).toBeAttached();
  });

  test('Transfer button with no member selected does not open confirm dialog', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await page.getByRole('button', { name: /transfer/i }).first().click();
    await expect(page.locator('.confirmDialog')).not.toBeVisible();
  });

  test('transfer ownership shows confirm dialog and calls API on confirm', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/transfer-ownership`, 'POST', 200, { message: 'Ownership transferred' });

    const dropdown = page.locator('select.gdInput').filter({ hasText: /select approved member/i });
    await dropdown.selectOption(MEMBER_USER_ID);
    await page.getByRole('button', { name: /transfer/i }).first().click();

    const confirmDialog = page.locator('.confirmDialog');
    await expect(confirmDialog).toBeVisible({ timeout: 2000 });
    await expect(confirmDialog).toContainText(/transfer ownership/i);

    await confirmDialog.getByRole('button', { name: /transfer/i }).click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('cancel in transfer dialog dismisses it without calling API', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);

    const dropdown = page.locator('select.gdInput').filter({ hasText: /select approved member/i });
    await dropdown.selectOption(MEMBER_USER_ID);
    await page.getByRole('button', { name: /transfer/i }).first().click();

    const confirmDialog = page.locator('.confirmDialog');
    await expect(confirmDialog).toBeVisible({ timeout: 2000 });

    await confirmDialog.getByRole('button', { name: /cancel/i }).click();
    await expect(confirmDialog).not.toBeVisible();
  });

  test('shows error toast when transfer fails', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/transfer-ownership`, 'POST', 400, { error: 'Transfer not allowed' });

    const dropdown = page.locator('select.gdInput').filter({ hasText: /select approved member/i });
    await dropdown.selectOption(MEMBER_USER_ID);
    await page.getByRole('button', { name: /transfer/i }).first().click();

    const confirmDialog = page.locator('.confirmDialog');
    await expect(confirmDialog).toBeVisible({ timeout: 2000 });
    await confirmDialog.getByRole('button', { name: /transfer/i }).click();

    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  test('owner does not appear in transfer dropdown', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    const dropdown = page.locator('select.gdInput').filter({ hasText: /select approved member/i });
    await expect(dropdown.locator(`option[value="${OWNER_USER_ID}"]`)).not.toBeAttached();
  });
});
