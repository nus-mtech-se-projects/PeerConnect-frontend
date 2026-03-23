import { test, expect } from '@playwright/test';
import { authenticate, setupGroupMocks, createGroupData, GROUP_ID, OWNER_USER_ID } from './helpers/group-fixtures';

const MOCK_GROUP = createGroupData({ isAdmin: true });

test.describe('Modify Group', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('renders editable group form for owner', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    await expect(page.locator('input.gdInput').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
  });

  test('pre-fills group form fields with existing data', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const nameInput = page.locator('input.gdInput').first();
    await expect(nameInput).toHaveValue('Algorithms Study Group');
  });

  test('updates group details successfully (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Group updated' }) });
      } else { route.fallback(); }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const nameInput = page.locator('input.gdInput').first();
    await nameInput.clear();
    await nameInput.fill('Updated Algo Group');
    await page.getByRole('button', { name: /save group/i }).click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when update fails (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Group name is required' }) });
      } else { route.fallback(); }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const nameInput = page.locator('input.gdInput').first();
    await nameInput.clear();
    await nameInput.fill('Bad Name');
    await page.getByRole('button', { name: /save group/i }).click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  test('can change study mode dropdown', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Group updated' }) });
      } else { route.fallback(); }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const studyModeSelect = page.locator('select').first();
    await studyModeSelect.selectOption('hybrid');
    await page.getByRole('button', { name: /save group/i }).click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('can toggle approval required checkbox', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('dissolve button is visible for owner', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.locator('.gdDissolveBtn')).toBeVisible();
  });

  test('dissolve group with confirmation (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/dissolve`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Group dissolved' }) })
    );
    await page.goto(`/group/${GROUP_ID}`);
    await page.locator('.gdDissolveBtn').click();
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('Back to Dashboard button navigates to home', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await page.locator('.gdBackBtn').first().click();
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});
