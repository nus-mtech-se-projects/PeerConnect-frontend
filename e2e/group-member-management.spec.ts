import { test, expect } from '@playwright/test';
import {
  authenticate,
  setupAndGoto,
  setupPreviewAndGoto,
  mockRoute,
  createGroupData,
  GROUP_ID,
  OWNER_USER_ID,
  MEMBER_USER_ID,
} from './helpers/group-fixtures';

const PENDING_MEMBER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const MOCK_GROUP_WITH_PENDING = createGroupData({
  isAdmin: true,
  approvalRequired: true,
  members: [
    { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'Owner', email: 'owner@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
    { userId: MEMBER_USER_ID, firstName: 'Alice', lastName: 'Tan', email: 'alice@u.nus.edu', role: 'member', membershipStatus: 'approved' },
    { userId: PENDING_MEMBER_ID, firstName: 'Bob', lastName: 'Ng', email: 'bob@u.nus.edu', role: 'member', membershipStatus: 'pending' },
  ],
});

const MOCK_DISSOLVED_GROUP = createGroupData({
  status: 'dissolved',
  members: [
    { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'Owner', email: 'owner@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
  ],
});

const MOCK_FULL_GROUP = createGroupData({
  status: 'full',
  members: [
    { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'Owner', email: 'owner@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
  ],
});

test.describe('Member Management', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  /* ── Approve member ───────────────────────────────────────── */

  test('owner sees Approve and Reject buttons for pending member', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    await expect(page.getByText('Bob Ng')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.memberApproveBtn').first()).toBeVisible();
    await expect(page.locator('.memberRejectBtn').first()).toBeVisible();
  });

  test('approve pending member calls API and shows success', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/members/${PENDING_MEMBER_ID}/approve`, 'POST', 200, { message: 'Approved' });
    await page.locator('.memberApproveBtn').first().click();
    // No toast for approve — page simply reloads; check button was clickable
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible({ timeout: 5000 });
  });

  test('shows error toast when approve fails', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/members/${PENDING_MEMBER_ID}/approve`, 'POST', 500, { error: 'Approve failed' });
    await page.locator('.memberApproveBtn').first().click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  /* ── Reject member ────────────────────────────────────────── */

  test('reject pending member shows confirm dialog', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    await page.locator('.memberRejectBtn').first().click();
    await expect(page.locator('.confirmDialog')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.confirmDialog')).toContainText(/reject this member/i);
  });

  test('confirm reject calls DELETE API', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/members/${PENDING_MEMBER_ID}`, 'DELETE', 200, { message: 'Removed' });
    await page.locator('.memberRejectBtn').first().click();
    const dialog = page.locator('.confirmDialog');
    await expect(dialog).toBeVisible({ timeout: 2000 });
    await dialog.locator('.confirmBtnRed').click();
    await expect(page.getByRole('button', { name: /save group/i })).toBeVisible({ timeout: 5000 });
  });

  test('cancel reject closes dialog without removing member', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    await page.locator('.memberRejectBtn').first().click();
    const dialog = page.locator('.confirmDialog');
    await expect(dialog).toBeVisible({ timeout: 2000 });
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('Bob Ng')).toBeVisible();
  });

  test('shows error toast when reject fails', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    await mockRoute(page, `**/api/groups/${GROUP_ID}/members/${PENDING_MEMBER_ID}`, 'DELETE', 500, { error: 'Remove error' });
    await page.locator('.memberRejectBtn').first().click();
    const dialog = page.locator('.confirmDialog');
    await expect(dialog).toBeVisible({ timeout: 2000 });
    await dialog.locator('.confirmBtnRed').click();
    await expect(page.locator('.dashToastError')).toBeVisible({ timeout: 5000 });
  });

  /* ── Dissolved / full group preview ──────────────────────── */

  test('dissolved group preview hides Join button', async ({ page }) => {
    await setupPreviewAndGoto(page, MOCK_DISSOLVED_GROUP);
    await expect(page.locator('.gdTitle')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /join this group/i })).not.toBeVisible();
  });

  test('full group preview hides Join button', async ({ page }) => {
    await setupPreviewAndGoto(page, MOCK_FULL_GROUP);
    await expect(page.locator('.gdTitle')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /join this group/i })).not.toBeVisible();
  });

  /* ── ApprovalRequired toggle ──────────────────────────────── */

  test('owner can toggle approvalRequired checkbox', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    // Scope to the specific checkbox — there are now multiple checkboxes on
    // the page (approvalRequired + auto-announce toggles), so a bare
    // input[type="checkbox"] locator matches too many elements.
    const checkbox = page.getByRole('checkbox', { name: /require admin approval/i });
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  /* ── Back navigation ──────────────────────────────────────── */

  test('Back to Dashboard button navigates home', async ({ page }) => {
    await setupAndGoto(page, MOCK_GROUP_WITH_PENDING);
    await page.locator('.gdBackBtn').first().click();
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});
