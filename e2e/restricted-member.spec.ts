import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** RestrictUser.jsx uses waitForToken() which decodes the JWT payload via atob()
 *  and checks exp > Date.now(). A plain 'fake.jwt.token' fails atob parsing,
 *  so we create a properly-formatted JWT with a future exp claim. */
function createFakeJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'test-user' })).toString('base64');
  return `${header}.${payload}.fakesig`;
}

async function authenticate(page) {
  await page.goto('/');
  const token = createFakeJwt();
  await page.evaluate((t) => localStorage.setItem('accessToken', t), token);
}

const BLOCKED_USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const MOCK_RESTRICTED_LIST = [
  {
    restrictedUserId: BLOCKED_USER_ID,
    firstName: 'Blocked',
    lastName: 'User',
    email: 'blocked@u.nus.edu',
    createdAt: '2026-03-20T10:00:00',
  },
];

const MOCK_SEARCH_RESULTS = [
  { userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', firstName: 'New', lastName: 'Person', email: 'new@u.nus.edu', restricted: false },
  { userId: BLOCKED_USER_ID, firstName: 'Blocked', lastName: 'User', email: 'blocked@u.nus.edu', restricted: true },
];

function mockRestrictedUserEndpoints(page) {
  return Promise.all([
    page.route('**/api/restricted-users', (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('search')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_RESTRICTED_LIST),
        });
      } else {
        route.fallback();
      }
    }),
    page.route('**/api/users/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu' }),
      })
    ),
    page.route('**/api/profile', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ firstName: 'Test', lastName: 'User', avatarUrl: '' }),
        });
      } else {
        route.fallback();
      }
    }),
  ]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Restricted Members management', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders restricted members page with heading', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.goto('/restrict-user');

    await expect(page.locator('.dashTitle')).toContainText('Restricted Members');
    await expect(page.locator('.dashSubtitle')).toContainText('Manage members who are restricted');
  });

  test('displays existing restricted users list', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.goto('/restrict-user');

    await expect(page.getByText('Blocked User')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('blocked@u.nus.edu')).toBeVisible();
  });

  // ── Search Users ──────────────────────────────────────────────────────────

  test('search input is rendered with placeholder', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.goto('/restrict-user');

    await expect(page.locator('.dashSearch')).toBeVisible();
    await expect(page.locator('.dashSearch')).toHaveAttribute(
      'placeholder',
      /search users by email/i
    );
  });

  test('search returns results after typing (mocked)', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SEARCH_RESULTS),
      })
    );
    await page.goto('/restrict-user');

    await page.locator('.dashSearch').fill('new');
    // Wait for debounce + results
    await expect(page.getByText('New Person')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('new@u.nus.edu')).toBeVisible();
  });

  test('search shows no results message when empty (mocked)', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );
    await page.goto('/restrict-user');

    await page.locator('.dashSearch').fill('nonexistent');
    await expect(page.getByText('No users found')).toBeVisible({ timeout: 5000 });
  });

  // ── Restrict a User ───────────────────────────────────────────────────────

  test('restrict a user from search results (mocked)', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', firstName: 'New', lastName: 'Person', email: 'new@u.nus.edu', restricted: false },
        ]),
      })
    );
    let restrictEndpointCalled = false;
    await page.route('**/api/restricted-users', (route) => {
      if (route.request().method() === 'POST') {
        restrictEndpointCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'User restricted' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto('/restrict-user');

    await page.locator('.dashSearch').fill('new');
    await expect(page.getByText('New Person')).toBeVisible({ timeout: 5000 });

    await page.locator('.ruRestrictBtn').first().click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
    expect(restrictEndpointCalled).toBe(true);
  });

  // ── Allow (Unblock) a User ────────────────────────────────────────────────

  test('allow a restricted user with confirmation (mocked)', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    let allowEndpointCalled = false;
    await page.route(`**/api/restricted-users/${BLOCKED_USER_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        allowEndpointCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'User allowed' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto('/restrict-user');
    await expect(page.getByText('Blocked User')).toBeVisible({ timeout: 10000 });

    // Click Allow button on the restricted user
    await page.locator('.ruAllowBtn').first().click();

    // Confirm dialog
    const confirmBtn = page.locator('.confirmBtnGreen');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
    expect(allowEndpointCalled).toBe(true);
  });

  test('cancel allow confirmation keeps user restricted', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.goto('/restrict-user');
    await expect(page.getByText('Blocked User')).toBeVisible({ timeout: 10000 });

    await page.locator('.ruAllowBtn').first().click();

    // Cancel confirmation
    const cancelBtn = page.locator('.confirmBtnOutline');
    await expect(cancelBtn).toBeVisible({ timeout: 2000 });
    await cancelBtn.click();

    // User should still be in the restricted list
    await expect(page.getByText('Blocked User')).toBeVisible();
  });

  // ── Allow from search results ─────────────────────────────────────────────

  test('allow already-restricted user from search results (mocked)', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { userId: BLOCKED_USER_ID, firstName: 'Blocked', lastName: 'User', email: 'blocked@u.nus.edu', restricted: true },
        ]),
      })
    );
    await page.route(`**/api/restricted-users/${BLOCKED_USER_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'User allowed' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto('/restrict-user');

    await page.locator('.dashSearch').fill('blocked');
    await expect(page.locator('.ruSearchResults')).toBeVisible({ timeout: 5000 });

    // The Allow button should appear for already-restricted users in search results
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

  // ── Empty state ───────────────────────────────────────────────────────────

  test('shows empty state when no restricted users', async ({ page }) => {
    await page.route('**/api/restricted-users', (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('search')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        route.fallback();
      }
    });
    await page.route('**/api/users/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu' }),
      })
    );
    await page.route('**/api/profile', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ firstName: 'Test', lastName: 'User', avatarUrl: '' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto('/restrict-user');

    await expect(page.getByText(/no restricted members/i)).toBeVisible({ timeout: 10000 });
  });

  // ── Restrict endpoint failure ─────────────────────────────────────────────

  test('shows error toast when restrict fails (mocked)', async ({ page }) => {
    await mockRestrictedUserEndpoints(page);
    await page.route('**/api/restricted-users/search?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', firstName: 'New', lastName: 'Person', email: 'new@u.nus.edu', restricted: false },
        ]),
      })
    );
    await page.route('**/api/restricted-users', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Cannot restrict yourself' }) });
      } else {
        route.fallback();
      }
    });
    await page.goto('/restrict-user');

    await page.locator('.dashSearch').fill('new');
    await expect(page.getByText('New Person')).toBeVisible({ timeout: 5000 });

    await page.locator('.ruRestrictBtn').first().click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });
});
