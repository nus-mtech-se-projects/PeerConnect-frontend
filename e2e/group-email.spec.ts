import { test, expect } from '@playwright/test';
import { authenticate, setupGroupMocks, createGroupData, GROUP_ID, OWNER_USER_ID, MEMBER_USER_ID } from './helpers/group-fixtures';

const MOCK_GROUP = createGroupData({
  approvalRequired: true,
  isAdmin: true,
  members: [
    { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
    { userId: MEMBER_USER_ID, firstName: 'Pending', lastName: 'Member', email: 'pending@u.nus.edu', role: 'member', membershipStatus: 'pending' },
  ],
});

test.describe('Email notifications on group actions', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('invite member sends email notification (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    let inviteEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/members/invite`, (route) => {
      inviteEndpointCalled = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Invitation sent' }) });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const inviteInput = page.getByPlaceholder('student@u.nus.edu');
    await inviteInput.fill('newmember@u.nus.edu');
    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
    expect(inviteEndpointCalled).toBe(true);
  });

  test('approve pending member sends email notification (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    let approveEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/members/${MEMBER_USER_ID}/approve`, (route) => {
      approveEndpointCalled = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Member approved' }) });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const approveBtn = page.locator('.memberApproveBtn').first();
    await approveBtn.click();
    await expect(async () => { expect(approveEndpointCalled).toBe(true); }).toPass({ timeout: 5000 });
  });

  test('reject pending member sends email notification (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    let rejectEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/members/${MEMBER_USER_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        rejectEndpointCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Member removed' }) });
      } else { route.fallback(); }
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const rejectBtn = page.locator('.memberRejectBtn').first();
    await rejectBtn.click();
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    await expect(async () => { expect(rejectEndpointCalled).toBe(true); }).toPass({ timeout: 5000 });
  });

  test('dissolve group sends email to all members (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    let dissolveEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}/dissolve`, (route) => {
      dissolveEndpointCalled = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Group dissolved' }) });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await page.locator('.gdDissolveBtn').click();
    const confirmBtn = page.locator('.confirmBtnRed');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();
    expect(dissolveEndpointCalled).toBe(true);
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('update group details sends notification to members (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    let updateEndpointCalled = false;
    await page.route(`**/api/groups/${GROUP_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        updateEndpointCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Group updated' }) });
      } else { route.fallback(); }
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

  test('shows email sending overlay during invite (mocked)', async ({ page }) => {
    await setupGroupMocks(page, MOCK_GROUP);
    await page.route(`**/api/groups/${GROUP_ID}/members/invite`, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Invitation sent' }) });
    });
    await page.goto(`/group/${GROUP_ID}`);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible();
    const inviteInput = page.getByPlaceholder('student@u.nus.edu');
    await inviteInput.fill('newmember@u.nus.edu');
    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.locator('.gdEmailOverlay')).toBeVisible({ timeout: 3000 });
  });
});
