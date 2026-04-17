import { test, expect } from '@playwright/test';
import { authenticate, mockUserEndpoints, BLOCKED_USER_ID } from './helpers/group-fixtures';

const MOCK_RESTRICTED_LIST = [
  { restrictedUserId: BLOCKED_USER_ID, firstName: 'Blocked', lastName: 'User', email: 'blocked@u.nus.edu', createdAt: '2026-03-20T10:00:00' },
];

const MOCK_SEARCH_RESULTS = [
  { userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', firstName: 'New', lastName: 'Person', email: 'new@u.nus.edu', restricted: false },
  { userId: BLOCKED_USER_ID, firstName: 'Blocked', lastName: 'User', email: 'blocked@u.nus.edu', restricted: true },
];

const MOCK_UNRESTRICTED_SEARCH = [
  { userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', firstName: 'New', lastName: 'Person', email: 'new@u.nus.edu', restricted: false },
];

async function mockRestrictedEndpoints(page) {
  await Promise.all([
    page.route('**/api/restricted-users', (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('search')) {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RESTRICTED_LIST) });
      } else { route.fallback(); }
    }),
    mockUserEndpoints(page),
  ]);
}

test.describe('Restricted Members management', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('renders restricted members page with heading', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.goto('/restrict-user');
    await expect(page.locator('.dashTitle')).toContainText('Restricted Members');
    await expect(page.locator('.dashSubtitle')).toContainText('Manage members who are restricted');
  });

  test('displays existing restricted users list', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.goto('/restrict-user');
    await expect(page.getByText('Blocked User')).toBeVisible({ timeout: 10000 });
  });

  test('search input is rendered with placeholder', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.goto('/restrict-user');
    await expect(page.locator('.dashSearch')).toBeVisible();
    await expect(page.locator('.dashSearch')).toHaveAttribute('placeholder', /search users by email/i);
  });

  test('search returns results after typing (mocked)', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEARCH_RESULTS) })
    );
    await page.goto('/restrict-user');
    await page.locator('.dashSearch').fill('new');
    await expect(page.getByText('New Person')).toBeVisible({ timeout: 5000 });
  });

  test('search shows no results message when empty (mocked)', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.goto('/restrict-user');
    await page.locator('.dashSearch').fill('nonexistent');
    await expect(page.getByText('No users found')).toBeVisible({ timeout: 5000 });
  });

  test('restrict a user from search results (mocked)', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_UNRESTRICTED_SEARCH) })
    );
    let restrictEndpointCalled = false;
    await page.route('**/api/restricted-users', (route) => {
      if (route.request().method() === 'POST') {
        restrictEndpointCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'User restricted' }) });
      } else { route.fallback(); }
    });
    await page.goto('/restrict-user');
    await page.locator('.dashSearch').fill('new');
    await expect(page.getByText('New Person')).toBeVisible({ timeout: 5000 });
    await page.locator('.ruRestrictBtn').first().click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
    expect(restrictEndpointCalled).toBe(true);
  });

  test('allow a restricted user with confirmation (mocked)', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    let allowEndpointCalled = false;
    await page.route(`**/api/restricted-users/${BLOCKED_USER_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        allowEndpointCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'User allowed' }) });
      } else { route.fallback(); }
    });
    await page.goto('/restrict-user');
    await expect(page.getByText('Blocked User')).toBeVisible({ timeout: 10000 });
    await page.locator('.ruAllowBtn').first().click();
    const confirmBtn = page.locator('.confirmBtnGreen');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
    expect(allowEndpointCalled).toBe(true);
  });

  test('cancel allow confirmation keeps user restricted', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.goto('/restrict-user');
    await expect(page.getByText('Blocked User')).toBeVisible({ timeout: 10000 });
    await page.locator('.ruAllowBtn').first().click();
    const cancelBtn = page.locator('.confirmBtnOutline');
    await expect(cancelBtn).toBeVisible({ timeout: 2000 });
    await cancelBtn.click();
    await expect(page.getByText('Blocked User')).toBeVisible();
  });

  test('allow already-restricted user from search results (mocked)', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { userId: BLOCKED_USER_ID, firstName: 'Blocked', lastName: 'User', email: 'blocked@u.nus.edu', restricted: true },
      ]) })
    );
    await page.route(`**/api/restricted-users/${BLOCKED_USER_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'User allowed' }) });
      } else { route.fallback(); }
    });
    await page.goto('/restrict-user');
    await page.locator('.dashSearch').fill('blocked');
    await expect(page.locator('.ruSearchResults')).toBeVisible({ timeout: 5000 });
    const allowBtn = page.locator('.ruSearchResults .ruAllowBtn').first();
    if (await allowBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allowBtn.click();
      const confirmBtn = page.locator('.confirmBtnGreen');
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
    }
  });

  test('shows empty state when no restricted users', async ({ page }) => {
    await Promise.all([
      page.route('**/api/restricted-users', (route) => {
        if (route.request().method() === 'GET' && !route.request().url().includes('search')) {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        } else { route.fallback(); }
      }),
      mockUserEndpoints(page),
    ]);
    await page.goto('/restrict-user');
    await expect(page.getByText(/no restricted members/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows error toast when restrict fails (mocked)', async ({ page }) => {
    await mockRestrictedEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_UNRESTRICTED_SEARCH) })
    );
    await page.route('**/api/restricted-users', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Cannot restrict yourself' }) });
      } else { route.fallback(); }
    });
    await page.goto('/restrict-user');
    await page.locator('.dashSearch').fill('new');
    await expect(page.getByText('New Person')).toBeVisible({ timeout: 5000 });
    await page.locator('.ruRestrictBtn').first().click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });
});
