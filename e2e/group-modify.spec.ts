import { test, expect } from '@playwright/test';
import { authenticate, setupAndGoto, mockRoute, createGroupData, GROUP_ID } from './helpers/group-fixtures';

const MOCK_GROUP = createGroupData({ isAdmin: true });

test.describe('Modify Group', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('renders editable group form for owner with pre-filled data', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    const nameInput = page.locator('input.gdInput').first();
    await expect(nameInput).toHaveValue('Algorithms Study Group');
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    await expect(page.locator('.gdDissolveBtn')).toBeVisible();
  });

  test('updates group details successfully', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}`, 'PUT', 200, { message: 'Group updated' });
    const nameInput = page.locator('input.gdInput').first();
    await nameInput.clear();
    await nameInput.fill('Updated Algo Group');
    await page.getByRole('button', { name: /save group/i }).click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when update fails', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}`, 'PUT', 400, { error: 'Group name is required' });
    const nameInput = page.locator('input.gdInput').first();
    await nameInput.clear();
    await nameInput.fill('Bad Name');
    await page.getByRole('button', { name: /save group/i }).click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  test('dissolve group with confirmation navigates home', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/dissolve`, 'POST', 200, { message: 'Group dissolved' });
    await page.locator('.gdDissolveBtn').click();
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});
