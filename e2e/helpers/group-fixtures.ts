import { Page } from '@playwright/test';

// ── Constants ─────────────────────────────────────────────────────────────────

export const GROUP_ID = '11111111-1111-1111-1111-111111111111';
export const OWNER_USER_ID = '99999999-9999-9999-9999-999999999999';
export const CURRENT_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const MEMBER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const BLOCKED_USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const SESSION_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

// ── Auth helpers ──────────────────────────────────────────────────────────────

export function createFakeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'test-user' })
  ).toString('base64');
  return `${header}.${payload}.fakesig`;
}

export async function authenticate(page: Page, { fakeJwt = false } = {}) {
  await page.goto('/');
  if (fakeJwt) {
    const token = createFakeJwt();
    await page.evaluate((t) => localStorage.setItem('accessToken', t), token);
  } else {
    await page.evaluate(() => localStorage.setItem('accessToken', 'fake.jwt.token'));
  }
}

// ── Mock data factory ─────────────────────────────────────────────────────────

export function createGroupData(overrides: Record<string, unknown> = {}) {
  return {
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
    members: [
      { userId: OWNER_USER_ID, firstName: 'Test', lastName: 'User', email: 'test@u.nus.edu', role: 'owner', membershipStatus: 'approved' },
    ],
    sessions: [],
    ...overrides,
  };
}

// ── Route mocking helpers ─────────────────────────────────────────────────────

export async function mockUserEndpoints(page: Page) {
  await Promise.all([
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

export async function mockGroupEndpoint(page: Page, groupData: object, groupId = GROUP_ID) {
  await page.route('**/api/groups/' + groupId, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(groupData) });
    } else {
      route.fallback();
    }
  });
}

export async function mockGroupEndpointForbidden(page: Page, groupId = GROUP_ID) {
  await page.route('**/api/groups/' + groupId, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 403, body: 'Forbidden' });
    } else {
      route.fallback();
    }
  });
}

export async function mockGroupsListEndpoint(page: Page, groups: unknown[]) {
  await page.route('**/api/groups', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(groups) });
    } else {
      route.fallback();
    }
  });
}

// ── Composite setup helpers ───────────────────────────────────────────────────

export async function setupGroupMocks(page: Page, groupData: object, groupId = GROUP_ID) {
  await Promise.all([
    mockGroupEndpoint(page, groupData, groupId),
    mockUserEndpoints(page),
  ]);
}

export async function setupGroupPreviewMocks(page: Page, groupData: object, groupId = GROUP_ID) {
  await Promise.all([
    mockGroupEndpointForbidden(page, groupId),
    mockGroupsListEndpoint(page, [groupData]),
    mockUserEndpoints(page),
  ]);
}

// ── Page-action helpers (reduce duplication across specs) ─────────────────────

export async function gotoGroup(page: Page, groupId = GROUP_ID) {
  await page.goto(`/group/${groupId}`);
}

export async function setupAndGoto(page: Page, groupData: object, groupId = GROUP_ID) {
  await setupGroupMocks(page, groupData, groupId);
  await gotoGroup(page, groupId);
}

export async function setupPreviewAndGoto(page: Page, groupData: object, groupId = GROUP_ID) {
  await setupGroupPreviewMocks(page, groupData, groupId);
  await gotoGroup(page, groupId);
}

export function mockRoute(page: Page, urlPattern: string, method: string, status: number, body: object) {
  return page.route(urlPattern, (route) => {
    if (route.request().method() === method) {
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    } else { route.fallback(); }
  });
}

export async function clickAndConfirm(page: Page, triggerLocator: ReturnType<Page['locator']>, confirmLabel: string) {
  await triggerLocator.click();
  const confirmBtn = page.locator('.confirmDialog').getByRole('button', { name: confirmLabel });
  await confirmBtn.waitFor({ state: 'visible', timeout: 2000 });
  await confirmBtn.click();
}

export function getTransferDropdown(page: Page) {
  return page.locator('select.gdInput').filter({ hasText: /select approved member/i });
}

export async function openTransferDialog(page: Page, memberId: string) {
  const dropdown = getTransferDropdown(page);
  await dropdown.selectOption(memberId);
  await page.getByRole('button', { name: /transfer/i }).first().click();
  return page.locator('.confirmDialog');
}

export async function triggerInviteMember(page: Page, email: string) {
  await page.getByPlaceholder('student@u.nus.edu').fill(email);
  await page.getByRole('button', { name: /invite/i }).click();
}

export async function approveFirstPendingMember(page: Page) {
  await page.locator('.memberApproveBtn').first().click();
}

export async function rejectFirstPendingMember(page: Page) {
  await page.locator('.memberRejectBtn').first().click();
  const confirmBtn = page.locator('.confirmBtnRed');
  await confirmBtn.waitFor({ state: 'visible', timeout: 2000 });
  await confirmBtn.click();
}

export async function fillSessionForm(page: Page, data: { title: string; date: string; time: string }) {
  const section = page.locator('.gdSection').filter({ hasText: /scheduled sessions/i });
  await section.locator('.gdForm input.gdInput[required]').first().fill(data.title);
  await section.locator('input[type="date"]').first().fill(data.date);
  await section.locator('input[type="time"]').first().fill(data.time);
}
