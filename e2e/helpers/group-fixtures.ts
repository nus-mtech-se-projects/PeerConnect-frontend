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
