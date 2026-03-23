import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function authenticate(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('accessToken', 'fake.jwt.token'));
}

const OWNER_USER_ID = '99999999-9999-9999-9999-999999999999';
const MEMBER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const GROUP_ID = '11111111-1111-1111-1111-111111111111';

const MOCK_GROUP_WITH_MEMBERS = {
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
  approvalRequired: true,
  status: 'active',
  createdBy: OWNER_USER_ID,
  isAdmin: true,
  members: [
    { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
    { userId: MEMBER_USER_ID, firstName: 'Pending', lastName: 'Member', email: 'pending@u.nus.edu', role: 'member', membershipStatus: 'pending' },
  ],
  sessions: [],
};

function mockGroupWithEmail(page) {
  return Promise.all([
    page.route('**/api/groups/' + GROUP_ID, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GROUP_WITH_MEMBERS),
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

test.describe('Email notifications on group actions', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Invite Member triggers email ──────────────────────────────────────────

  test('invite member sends email notification (mocked)', async ({ page }) => {
    await mockGroupWithEmail(page);
    let inviteEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/members/invite`, (route) => {
      inviteEndpointCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invitation sent' }),
      });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    // Fill invite email and submit
    const inviteInput = page.getByPlaceholder('student@u.nus.edu');
    await inviteInput.fill('newmember@u.nus.edu');
    await page.getByRole('button', { name: /invite/i }).click();

    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
    expect(inviteEndpointCalled).toBe(true);
  });

  // ── Approve member triggers email ─────────────────────────────────────────

  test('approve pending member sends email notification (mocked)', async ({ page }) => {
    await mockGroupWithEmail(page);
    let approveEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/members/${MEMBER_USER_ID}/approve`, (route) => {
      approveEndpointCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Member approved' }),
      });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    // Click approve button for pending member
    const approveBtn = page.locator('.memberApproveBtn').first();
    await approveBtn.click();

    // handleApproveMember sets sendingEmail=true (shows email overlay) but no success toast
    // Wait for the approve API call to complete
    await expect(async () => {
      expect(approveEndpointCalled).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  // ── Reject/Remove member triggers email ───────────────────────────────────

  test('reject pending member sends email notification (mocked)', async ({ page }) => {
    await mockGroupWithEmail(page);
    let rejectEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/members/${MEMBER_USER_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        rejectEndpointCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Member removed' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    const rejectBtn = page.locator('.memberRejectBtn').first();
    await rejectBtn.click();

    // Handle confirmation dialog — reject uses confirmBtnClass "confirmBtnRed"
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    // executeRemoveMember sets sendingEmail=true but no success toast
    await expect(async () => {
      expect(rejectEndpointCalled).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  // ── Dissolve group triggers email to all members ──────────────────────────

  test('dissolve group sends email to all members (mocked)', async ({ page }) => {
    await mockGroupWithEmail(page);
    let dissolveEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/dissolve`, (route) => {
      dissolveEndpointCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Group dissolved' }),
      });
    });
    await page.goto(`/group/${GROUP_ID}`);

    await page.locator('.gdDissolveBtn').click();

    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    // Verify dissolve endpoint was called (sends email on backend)
    expect(dissolveEndpointCalled).toBe(true);
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  // ── Update group triggers email to members ────────────────────────────────

  test('update group details sends notification to members (mocked)', async ({ page }) => {
    await mockGroupWithEmail(page);
    let updateEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        updateEndpointCalled = true;
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

    const nameInput = page.locator('input.gdInput').first();
    await nameInput.clear();
    await nameInput.fill('Renamed Group');

    await page.getByRole('button', { name: /save group/i }).click();

    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
    expect(updateEndpointCalled).toBe(true);
  });

  // ── Email overlay shows during async operations ───────────────────────────

  test('shows email sending overlay during invite (mocked)', async ({ page }) => {
    await mockGroupWithEmail(page);
    await page.route(`**/api/groups/${GROUP_ID}/members/invite`, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invitation sent' }),
      });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    const inviteInput = page.getByPlaceholder('student@u.nus.edu');
    await inviteInput.fill('newmember@u.nus.edu');
    await page.getByRole('button', { name: /invite/i }).click();

    // Check for email overlay
    await expect(page.locator('.gdEmailOverlay')).toBeVisible({ timeout: 3000 });
  });
});
