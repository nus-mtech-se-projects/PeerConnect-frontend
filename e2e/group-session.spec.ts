import { test, expect } from '@playwright/test';
import { authenticate, setupAndGoto, fillSessionForm, mockRoute, createGroupData, GROUP_ID, OWNER_USER_ID, MEMBER_USER_ID, SESSION_ID } from './helpers/group-fixtures';

const MOCK_SESSION = {
  id: SESSION_ID,
  title: 'Week 1 - Bubble Sort',
  startsAt: '2099-04-12T10:00:00',
  endsAt: '2099-04-12T12:00:00',
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

test.describe('Study Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('renders session form and displays existing sessions', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await expect(page.getByRole('button', { name: /create session/i })).toBeVisible();
    await expect(page.locator('.gdLabel').filter({ hasText: /session title/i })).toBeVisible();
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible({ timeout: 5000 });
  });

  test('creates session and clears form', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/sessions`, 'POST', 200, { message: 'Session created' });
    await fillSessionForm(page, { title: 'Week 2 - Merge Sort', date: '2099-04-20', time: '14:00' });
    await page.getByRole('button', { name: /create session/i }).click();
    const titleInput = page.locator('.gdSection').filter({ hasText: /scheduled sessions/i }).locator('.gdForm input.gdInput[required]').first();
    await expect(titleInput).toHaveValue('', { timeout: 5000 });
  });

  test('shows error when session creation fails', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/sessions`, 'POST', 400, { error: 'Session title is required' });
    await fillSessionForm(page, { title: 'Bad Session', date: '2099-04-21', time: '09:00' });
    await page.getByRole('button', { name: /create session/i }).click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  test('deletes session with confirmation', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/sessions/${SESSION_ID}`, 'DELETE', 200, { message: 'Session deleted' });
    await expect(page.getByText('Week 1 - Bubble Sort')).toBeVisible({ timeout: 5000 });
    await page.locator('.memberRejectBtn').filter({ hasText: /delete/i }).first().click();
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
  });
});
