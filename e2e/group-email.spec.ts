import { test, expect } from '@playwright/test';
import {
  authenticate,
  setupAndGoto,
  mockRoute,
  createGroupData,
  GROUP_ID,
  OWNER_USER_ID,
  MEMBER_USER_ID,
  triggerInviteMember,
  approveFirstPendingMember,
  rejectFirstPendingMember,
} from './helpers/group-fixtures';

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

  test('invite member sends email notification', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/members/invite`, 'POST', 200, { message: 'Invitation sent' });
    await triggerInviteMember(page, 'newmember@u.nus.edu');
    await expect(page.locator('.dashToastSuccess')).toBeVisible({ timeout: 5000 });
  });

  test('approve pending member triggers notification', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/members/${MEMBER_USER_ID}/approve`, 'POST', 200, { message: 'Member approved' });
    await approveFirstPendingMember(page);
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible({ timeout: 5000 });
  });

  test('reject pending member with confirmation triggers notification', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/members/${MEMBER_USER_ID}`, 'DELETE', 200, { message: 'Member removed' });
    await rejectFirstPendingMember(page);
  });
});
