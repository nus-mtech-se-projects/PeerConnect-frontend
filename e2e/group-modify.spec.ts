import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function authenticate(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('accessToken', 'fake.jwt.token'));
}

const OWNER_USER_ID = '99999999-9999-9999-9999-999999999999';
const GROUP_ID = '11111111-1111-1111-1111-111111111111';

const MOCK_GROUP_OWNER_VIEW = {
  id: GROUP_ID,
  name: 'Algorithms Study Group',
  moduleCode: 'CS2040',
  topic: 'Sorting Algorithms',
  studyMode: 'online',
  maxMembers: 10,
  location: '',
  meetingLink: 'https://zoom.us/j/123',
  preferredSchedule: '2026-04-01T14:00:00',
  description: 'Weekly algo practice',
  approvalRequired: false,
  status: 'active',
  createdBy: OWNER_USER_ID,
  isAdmin: true,
  members: [
    { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
  ],
  sessions: [],
};

function mockGroupDetailAsOwner(page) {
  return Promise.all([
    page.route('**/api/groups/' + GROUP_ID, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GROUP_OWNER_VIEW),
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

test.describe('Modify Group', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Rendering (Owner View) ────────────────────────────────────────────────

  test('renders editable group form for owner', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    await page.goto(`/group/${GROUP_ID}`);

    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    await expect(page.locator('input.gdInput').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
  });

  test('pre-fills group form fields with existing data', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    await page.goto(`/group/${GROUP_ID}`);

    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    // Check form is populated with existing values
    const nameInput = page.locator('input.gdInput').first();
    await expect(nameInput).toHaveValue('Algorithms Study Group');
  });

  // ── Successful Update ─────────────────────────────────────────────────────

  test('updates group details successfully (mocked)', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    // Use route.fallback() so non-PUT requests fall through to mockGroupDetailAsOwner
    await page.route(`**/api/groups/${GROUP_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Group updated' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    // Modify the group name
    const nameInput = page.locator('input.gdInput').first();
    await nameInput.clear();
    await nameInput.fill('Updated Algo Group');

    await page.getByRole('button', { name: /save group/i }).click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  // ── Update fails ──────────────────────────────────────────────────────────

  test('shows error when update fails (mocked)', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    await page.route(`**/api/groups/${GROUP_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Group name is required' }) });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    // Fill a value so HTML validation passes; the mock still returns 400
    const nameInput = page.locator('input.gdInput').first();
    await nameInput.clear();
    await nameInput.fill('Bad Name');

    await page.getByRole('button', { name: /save group/i }).click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  // ── Update study mode ─────────────────────────────────────────────────────

  test('can change study mode dropdown', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    await page.route(`**/api/groups/${GROUP_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Group updated' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    const studyModeSelect = page.locator('select').first();
    await studyModeSelect.selectOption('hybrid');

    await page.getByRole('button', { name: /save group/i }).click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  // ── Toggle approval required ──────────────────────────────────────────────

  test('can toggle approval required checkbox', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  // ── Dissolve Group ────────────────────────────────────────────────────────

  test('dissolve button is visible for owner', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    await page.goto(`/group/${GROUP_ID}`);

    await expect(page.locator('.gdDissolveBtn')).toBeVisible();
  });

  test('dissolve group with confirmation (mocked)', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    await page.route(`**/api/groups/${GROUP_ID}/dissolve`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Group dissolved' }),
      })
    );
    await page.goto(`/group/${GROUP_ID}`);

    await page.locator('.gdDissolveBtn').click();

    // Confirm dialog
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    // Should redirect to home after dissolve
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  // ── Back to Dashboard ─────────────────────────────────────────────────────

  test('Back to Dashboard button navigates to home', async ({ page }) => {
    await mockGroupDetailAsOwner(page);
    await page.goto(`/group/${GROUP_ID}`);

    // Two gdBackBtn exist in owner view (top + footer); use first
    await page.locator('.gdBackBtn').first().click();
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});
