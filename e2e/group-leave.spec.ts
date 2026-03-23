import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function authenticate(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('accessToken', 'fake.jwt.token'));
}

const CURRENT_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OWNER_USER_ID = '99999999-9999-9999-9999-999999999999';
const GROUP_ID = '11111111-1111-1111-1111-111111111111';

const MOCK_GROUP_MEMBER_VIEW = {
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
  isAdmin: false,
  members: [
    { userId: OWNER_USER_ID, firstName: 'Owner', lastName: 'User', email: 'owner@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
    { userId: CURRENT_USER_ID, firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu', role: 'member', membershipStatus: 'approved' },
  ],
  sessions: [],
};

function mockGroupDetailAsMember(page) {
  return Promise.all([
    page.route('**/api/groups/' + GROUP_ID, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GROUP_MEMBER_VIEW),
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

test.describe('Leave Group', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('shows Leave button for a group member', async ({ page }) => {
    await mockGroupDetailAsMember(page);
    await page.goto(`/group/${GROUP_ID}`);

    await expect(page.locator('.gdTitle')).toContainText('Algorithms Study Group');
    await expect(page.getByRole('button', { name: /leave this group/i })).toBeVisible();
  });

  // ── Successful Leave ──────────────────────────────────────────────────────

  test('leaves group successfully (mocked)', async ({ page }) => {
    await mockGroupDetailAsMember(page);
    await page.route(`**/api/groups/${GROUP_ID}/leave`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Left group' }),
      })
    );
    await page.goto(`/group/${GROUP_ID}`);

    await page.getByRole('button', { name: /leave this group/i }).click();
    // Confirm dialog — leave uses confirmBtnClass "gdLeaveBtn" with label "Leave"
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Leave' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  // ── Leave fails ───────────────────────────────────────────────────────────

  test('shows error when leave fails (mocked)', async ({ page }) => {
    await mockGroupDetailAsMember(page);
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

  // ── Leave button disabled during operation ────────────────────────────────

  test('leave button shows loading state while leaving', async ({ page }) => {
    await mockGroupDetailAsMember(page);
    await page.route(`**/api/groups/${GROUP_ID}/leave`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Left group' }),
      });
    });
    await page.goto(`/group/${GROUP_ID}`);

    await page.getByRole('button', { name: /leave this group/i }).click();
    const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Leave' });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    // After confirm, button text changes to "Leaving…" and is disabled
    await expect(page.getByRole('button', { name: /leaving/i })).toBeVisible({ timeout: 3000 });
  });

  // ── Cancel leave confirmation ─────────────────────────────────────────────

  test('cancel leave confirmation keeps user in group', async ({ page }) => {
    await mockGroupDetailAsMember(page);
    await page.goto(`/group/${GROUP_ID}`);

    await page.getByRole('button', { name: /leave this group/i }).click();
    // Cancel dialog — leave uses cancelBtnClass "gdCancelBtn" with label "Cancel"
    const cancelBtn = page.locator('.confirmDialog').getByRole('button', { name: 'Cancel' });
    await expect(cancelBtn).toBeVisible({ timeout: 2000 });
    await cancelBtn.click();

    // Leave button should still be visible (user is still a member)
    await expect(page.getByRole('button', { name: /leave this group/i })).toBeVisible();
  });
});
