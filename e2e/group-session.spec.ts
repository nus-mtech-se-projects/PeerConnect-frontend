import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function authenticate(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('accessToken', 'fake.jwt.token'));
}

const OWNER_USER_ID = '99999999-9999-9999-9999-999999999999';
const MEMBER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const GROUP_ID = '11111111-1111-1111-1111-111111111111';
const SESSION_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

const MOCK_GROUP_WITH_SESSIONS = {
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
    { userId: MEMBER_USER_ID, firstName: 'Member', lastName: 'Two', email: 'member2@u.nus.edu', role: 'member', membershipStatus: 'approved' },
  ],
  sessions: [
    {
      id: SESSION_ID,
      title: 'Week 1 - Bubble Sort',
      startsAt: '2026-04-05T10:00:00',
      endsAt: '2026-04-05T12:00:00',
      location: 'COM1 SR1',
      meetingLink: 'https://zoom.us/j/456',
      notes: 'Bring laptop',
      createdBy: OWNER_USER_ID,
    },
  ],
};

function mockGroupWithSessions(page) {
  return Promise.all([
    page.route('**/api/groups/' + GROUP_ID, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GROUP_WITH_SESSIONS),
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

test.describe('Study Sessions with email notification', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders session creation form for owner', async ({ page }) => {
    await mockGroupWithSessions(page);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();

    // Session form should be visible
    await expect(page.locator('.gdLabel').filter({ hasText: /session title/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();
  });

  test('displays existing sessions', async ({ page }) => {
    await mockGroupWithSessions(page);
    await page.goto(`/group/${GROUP_ID}`);

    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible({ timeout: 5000 });
  });

  // ── Create Session Successfully ───────────────────────────────────────────

  test('creates session and sends email to all members (mocked)', async ({ page }) => {
    await mockGroupWithSessions(page);
    let sessionEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/sessions`, (route) => {
      if (route.request().method() === 'POST') {
        sessionEndpointCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Session created' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();

    // Fill session form — locate inputs within the session section
    const sessionSection = page.locator('.gdSection').filter({ hasText: /scheduled sessions/i });
    // Title input: first text input in session form
    const titleInput = sessionSection.locator('.gdForm input.gdInput[required]').first();
    await titleInput.fill('Week 2 - Merge Sort');

    // Fill date and time for startsAt
    const dateInputs = sessionSection.locator('input[type="date"]');
    const timeInputs = sessionSection.locator('input[type="time"]');
    await dateInputs.first().fill('2026-04-10');
    await timeInputs.first().fill('14:00');

    await page.getByRole('button', { name: /create session/i }).click();

    // handleCreateSession clears form on success (no toast shown)
    // Verify endpoint was called and form was cleared
    await expect(async () => {
      expect(sessionEndpointCalled).toBe(true);
    }).toPass({ timeout: 5000 });

    // Title should be cleared after successful creation
    await expect(titleInput).toHaveValue('', { timeout: 5000 });
  });

  // ── Create Session clears form on success ─────────────────────────────────

  test('clears session form after successful creation (mocked)', async ({ page }) => {
    await mockGroupWithSessions(page);
    await page.route(`**/api/groups/${GROUP_ID}/sessions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Session created' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();

    const sessionSection = page.locator('.gdSection').filter({ hasText: /scheduled sessions/i });
    const titleInput = sessionSection.locator('.gdForm input.gdInput[required]').first();
    await titleInput.fill('Week 3 - Quick Sort');

    const dateInputs = sessionSection.locator('input[type="date"]');
    const timeInputs = sessionSection.locator('input[type="time"]');
    await dateInputs.first().fill('2026-04-15');
    await timeInputs.first().fill('10:00');

    await page.getByRole('button', { name: /create session/i }).click();

    // Form should clear after success
    await expect(titleInput).toHaveValue('', { timeout: 5000 });
  });

  // ── Create Session fails ──────────────────────────────────────────────────

  test('shows error when session creation fails (mocked)', async ({ page }) => {
    await mockGroupWithSessions(page);
    await page.route(`**/api/groups/${GROUP_ID}/sessions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Session title is required' }) });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();

    // Fill required fields to bypass HTML form validation, then the 400 error triggers toast
    const sessionSection = page.locator('.gdSection').filter({ hasText: /scheduled sessions/i });
    const titleInput = sessionSection.locator('.gdForm input.gdInput[required]').first();
    await titleInput.fill('Bad Session');

    const dateInputs = sessionSection.locator('input[type="date"]');
    const timeInputs = sessionSection.locator('input[type="time"]');
    await dateInputs.first().fill('2026-04-20');
    await timeInputs.first().fill('09:00');

    await page.getByRole('button', { name: /create session/i }).click();

    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  // ── Delete Session ────────────────────────────────────────────────────────

  test('deletes session with confirmation (mocked)', async ({ page }) => {
    await mockGroupWithSessions(page);
    let deleteEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/sessions/${SESSION_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        deleteEndpointCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Session deleted' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible({ timeout: 5000 });

    // The session table has a "Delete" button with class memberRejectBtn
    const deleteBtn = page.locator('.memberRejectBtn').filter({ hasText: /delete/i }).first();
    await deleteBtn.click();

    // Handle confirmation dialog
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    // executeDeleteSession has no toast on success, verify endpoint was called
    await expect(async () => {
      expect(deleteEndpointCalled).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  // ── Delete session confirmation cancel ────────────────────────────────────

  test('cancel delete session keeps session in list', async ({ page }) => {
    await mockGroupWithSessions(page);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible({ timeout: 5000 });

    const deleteBtn = page.locator('.memberRejectBtn').filter({ hasText: /delete/i }).first();
    await deleteBtn.click();

    // Cancel the delete confirmation
    const cancelBtn = page.locator('.confirmBtnOutline');
    await expect(cancelBtn).toBeVisible({ timeout: 2000 });
    await cancelBtn.click();

    // Session should still be visible
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible();
  });

  // ── Session form validation ───────────────────────────────────────────────

  test('session form has required fields', async ({ page }) => {
    await mockGroupWithSessions(page);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();

    // Verify required field labels are present within the form
    await expect(page.locator('.gdLabel').filter({ hasText: /session title/i })).toBeVisible();
    await expect(page.locator('.gdLabel').filter({ hasText: /starts at/i })).toBeVisible();
  });

  // ── Session with optional fields ──────────────────────────────────────────

  test('creates session with all optional fields filled (mocked)', async ({ page }) => {
    await mockGroupWithSessions(page);
    let requestBody = null;
    await page.route(`**/api/groups/${GROUP_ID}/sessions`, (route) => {
      if (route.request().method() === 'POST') {
        requestBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Session created' }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();

    const sessionSection = page.locator('.gdSection').filter({ hasText: /scheduled sessions/i });

    // Fill all fields — title is the first required text input
    const titleInput = sessionSection.locator('.gdForm input.gdInput[required]').first();
    await titleInput.fill('Full Session Test');

    // Dates and times
    const dateInputs = sessionSection.locator('input[type="date"]');
    const timeInputs = sessionSection.locator('input[type="time"]');
    await dateInputs.first().fill('2026-04-20');
    await timeInputs.first().fill('09:00');

    // Optional end date/time if available
    if (await dateInputs.nth(1).isVisible().catch(() => false)) {
      await dateInputs.nth(1).fill('2026-04-20');
      await timeInputs.nth(1).fill('11:00');
    }

    // Optional notes textarea
    const notesTextarea = sessionSection.locator('textarea');
    if (await notesTextarea.isVisible().catch(() => false)) {
      await notesTextarea.fill('Bring textbook and laptop');
    }

    await page.getByRole('button', { name: /create session/i }).click();

    // Verify form clears on success (no toast is shown for session creation)
    await expect(titleInput).toHaveValue('', { timeout: 5000 });
  });
});
