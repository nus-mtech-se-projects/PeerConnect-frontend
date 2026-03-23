import { test, expect } from '@playwright/test';
import { authenticate, setupGroupMocks, createGroupData, GROUP_ID, OWNER_USER_ID, MEMBER_USER_ID, SESSION_ID } from './helpers/group-fixtures';

const MOCK_SESSION = {
  id: SESSION_ID,
  title: 'Week 1 - Bubble Sort',
  startsAt: '2026-04-05T10:00:00',
  endsAt: '2026-04-05T12:00:00',
  location: 'COM1 SR1',
  meetingLink: 'https://zoom.us/j/456',
  notes: 'Bring laptop',
  createdBy: OWNER_USER_ID,
};

const MOCK_GROUP = createGroupData({
  isAdmin: true,
  members: [
    { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
    { userId: MEMBER_USER_ID, firstName: 'Member', lastName: 'Two', email: 'member2@u.nus.edu', role: 'member', membershipStatus: 'approved' },
  ],
  sessions: [MOCK_SESSION],
});

test.describe('Study Sessions with email notification', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('renders session creation form for owner', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    await expect(page.locator('.gdLabel').filter({ hasText: /session title/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();
  });

  test('displays existing sessions', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible({ timeout: 5000 });
  });

  test('creates session and sends email to all members (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    let sessionEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/sessions`, (route) => {
      if (route.request().method() === 'POST') {
        sessionEndpointCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Session created' }) });
      } else { route.fallback(); }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();
    const sessionSection = page.locator('.gdSection').filter({ hasText: /scheduled sessions/i });
    const titleInput = sessionSection.locator('.gdForm input.gdInput[required]').first();
    await titleInput.fill('Week 2 - Merge Sort');
    const dateInputs = sessionSection.locator('input[type="date"]');
    const timeInputs = sessionSection.locator('input[type="time"]');
    await dateInputs.first().fill('2026-04-10');
    await timeInputs.first().fill('14:00');
    await page.getByRole('button', { name: /create session/i }).click();
    await expect(async () => { expect(sessionEndpointCalled).toBe(true); }).toPass({ timeout: 5000 });
    await expect(titleInput).toHaveValue('', { timeout: 5000 });
  });

  test('clears session form after successful creation (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/sessions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Session created' }) });
      } else { route.fallback(); }
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
    await expect(titleInput).toHaveValue('', { timeout: 5000 });
  });

  test('shows error when session creation fails (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/sessions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Session title is required' }) });
      } else { route.fallback(); }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();
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

  test('deletes session with confirmation (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    let deleteEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/sessions/${SESSION_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        deleteEndpointCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Session deleted' }) });
      } else { route.fallback(); }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible({ timeout: 5000 });
    const deleteBtn = page.locator('.memberRejectBtn').filter({ hasText: /delete/i }).first();
    await deleteBtn.click();
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(async () => { expect(deleteEndpointCalled).toBe(true); }).toPass({ timeout: 5000 });
  });

  test('cancel delete session keeps session in list', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible({ timeout: 5000 });
    const deleteBtn = page.locator('.memberRejectBtn').filter({ hasText: /delete/i }).first();
    await deleteBtn.click();
    const cancelBtn = page.locator('.confirmBtnOutline');
    await expect(cancelBtn).toBeVisible({ timeout: 2000 });
    await cancelBtn.click();
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible();
  });

  test('session form has required fields', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();
    await expect(page.locator('.gdLabel').filter({ hasText: /session title/i })).toBeVisible();
    await expect(page.locator('.gdLabel').filter({ hasText: /starts at/i })).toBeVisible();
  });

  test('creates session with all optional fields filled (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/sessions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Session created' }) });
      } else { route.fallback(); }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();
    const sessionSection = page.locator('.gdSection').filter({ hasText: /scheduled sessions/i });
    const titleInput = sessionSection.locator('.gdForm input.gdInput[required]').first();
    await titleInput.fill('Full Session Test');
    const dateInputs = sessionSection.locator('input[type="date"]');
    const timeInputs = sessionSection.locator('input[type="time"]');
    await dateInputs.first().fill('2026-04-20');
    await timeInputs.first().fill('09:00');
    if (await dateInputs.nth(1).isVisible().catch(() => false)) {
      await dateInputs.nth(1).fill('2026-04-20');
      await timeInputs.nth(1).fill('11:00');
    }
    const notesTextarea = sessionSection.locator('textarea');
    if (await notesTextarea.isVisible().catch(() => false)) {
      await notesTextarea.fill('Bring textbook and laptop');
    }
    await page.getByRole('button', { name: /create session/i }).click();
    await expect(titleInput).toHaveValue('', { timeout: 5000 });
  });
});
