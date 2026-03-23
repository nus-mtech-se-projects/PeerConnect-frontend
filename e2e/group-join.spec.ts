import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function authenticate(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('accessToken', 'fake.jwt.token'));
}

const MOCK_GROUP_PREVIEW = {
  id: '11111111-1111-1111-1111-111111111111',
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
  createdBy: '99999999-9999-9999-9999-999999999999',
  members: [
    { userId: '99999999-9999-9999-9999-999999999999', firstName: 'Owner', lastName: 'User', email: 'owner@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
  ],
  sessions: [],
};

const MOCK_GROUPS_LIST = [MOCK_GROUP_PREVIEW];

function mockGroupDetailEndpoints(page, groupData = MOCK_GROUP_PREVIEW) {
  return Promise.all([
    // GET /api/groups/:id — return 403 for non-member to trigger preview
    page.route('**/api/groups/' + groupData.id, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 403, body: 'Forbidden' });
      } else {
        route.fallback();
      }
    }),
    // GET /api/groups — fallback list for preview mode
    page.route('**/api/groups', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GROUPS_LIST),
        });
      } else {
        route.fallback();
      }
    }),
    // mock profile for sidebar
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

test.describe('Join Group', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('shows group preview with Join button for non-member', async ({ page }) => {
    await mockGroupDetailEndpoints(page);
    await page.goto('/group/11111111-1111-1111-1111-111111111111');

    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    await expect(page.getByRole('button', { name: /join this group/i })).toBeVisible();
  });

  // ── Successful Join (no approval required) ────────────────────────────────

  test('joins group successfully when no approval required (mocked)', async ({ page }) => {
    await mockGroupDetailEndpoints(page);
    await page.route('**/api/groups/11111111-1111-1111-1111-111111111111/join', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Joined group' }),
      })
    );
    await page.goto('/group/11111111-1111-1111-1111-111111111111');

    await page.getByRole('button', { name: /join this group/i }).click();
    // Confirm dialog — join uses confirmBtnClass "gdSubmitBtn" with label "Join"
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  // ── Join with approval required ───────────────────────────────────────────

  test('shows pending message when approval is required (mocked)', async ({ page }) => {
    const groupWithApproval = { ...MOCK_GROUP_PREVIEW, approvalRequired: true };
    await mockGroupDetailEndpoints(page, groupWithApproval);
    await page.route('**/api/groups/11111111-1111-1111-1111-111111111111/join', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Join request submitted' }),
      })
    );
    await page.goto('/group/11111111-1111-1111-1111-111111111111');

    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    await expect(page.locator('.dashToast')).toBeVisible({ timeout: 5000 });
  });

  // ── Join fails - group full ───────────────────────────────────────────────

  test('shows error when group is full (mocked)', async ({ page }) => {
    await mockGroupDetailEndpoints(page);
    await page.route('**/api/groups/11111111-1111-1111-1111-111111111111/join', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Group is full' }) })
    );
    await page.goto('/group/11111111-1111-1111-1111-111111111111');

    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  // ── Join fails - already a member ─────────────────────────────────────────

  test('shows error when already a member (mocked)', async ({ page }) => {
    await mockGroupDetailEndpoints(page);
    await page.route('**/api/groups/11111111-1111-1111-1111-111111111111/join', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Already a member' }) })
    );
    await page.goto('/group/11111111-1111-1111-1111-111111111111');

    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  // ── Button disabled during join ───────────────────────────────────────────

  test('join button shows loading state while joining', async ({ page }) => {
    await mockGroupDetailEndpoints(page);
    // Delay the response to observe the loading state
    await page.route('**/api/groups/11111111-1111-1111-1111-111111111111/join', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Joined group' }),
      });
    });
    await page.goto('/group/11111111-1111-1111-1111-111111111111');

    await page.getByRole('button', { name: /join this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Join' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    // After confirm, button text changes to "Joining…" and is disabled
    await expect(page.getByRole('button', { name: /joining/i })).toBeVisible({ timeout: 3000 });
  });
});
