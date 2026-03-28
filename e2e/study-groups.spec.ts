import { test, expect } from '@playwright/test';

type Group = {
  id: string;
  name: string;
  moduleCode: string;
  topic: string;
  studyMode: 'online' | 'in-person' | 'hybrid';
  description?: string;
  preferredSchedule?: string;
  location?: string;
  meetingLink?: string;
  status?: string;
  memberCount: number;
  maxMembers: number;
  joined?: boolean;
  membershipStatus?: string;
  isAdmin?: boolean;
  createdBy?: string;
  members?: Member[];
  sessions?: Session[];
};

type Member = {
  userId: string;
  email: string;
  role: string;
  membershipStatus: string;
  firstName?: string;
  lastName?: string;
};

type Session = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  meetingLink?: string;
};

function buildAccessToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');

  return `${header}.${payload}.signature`;
}

async function authenticate(page) {
  await page.goto('/');
  await page.evaluate((token) => localStorage.setItem('accessToken', token), buildAccessToken());
}

async function stubDashboardApi(page) {
  const groups: Group[] = [
    {
      id: 'group-1',
      name: 'CS2030 Debugging Circle',
      moduleCode: 'CS2030',
      topic: 'Streams and lambdas',
      studyMode: 'online',
      description: 'Weekly debugging drills and practice questions.',
      preferredSchedule: 'Tue 7-9pm',
      meetingLink: 'https://example.test/room/cs2030',
      memberCount: 3,
      maxMembers: 8,
      joined: false,
      membershipStatus: 'not_joined',
      isAdmin: false,
      status: 'active',
      createdBy: 'owner-2',
    },
    {
      id: 'group-2',
      name: 'CS2100 Midterm Prep',
      moduleCode: 'CS2100',
      topic: 'Pipelines',
      studyMode: 'hybrid',
      description: 'Exam prep with admin-only membership approvals.',
      preferredSchedule: 'Thu 6-8pm',
      location: 'COM1-02-12',
      meetingLink: 'https://example.test/room/cs2100',
      memberCount: 4,
      maxMembers: 10,
      joined: true,
      membershipStatus: 'approved',
      isAdmin: true,
      status: 'active',
      createdBy: 'user-1',
      members: [
        {
          userId: 'user-1',
          email: 'owner@u.nus.edu',
          role: 'owner',
          membershipStatus: 'approved',
          firstName: 'Owner',
          lastName: 'User',
        },
        {
          userId: 'user-2',
          email: 'member@u.nus.edu',
          role: 'member',
          membershipStatus: 'approved',
          firstName: 'Jamie',
          lastName: 'Tan',
        },
        {
          userId: 'user-3',
          email: 'pending@u.nus.edu',
          role: 'member',
          membershipStatus: 'pending',
          firstName: 'Pending',
          lastName: 'Lee',
        },
      ],
      sessions: [
        {
          id: 'session-1',
          title: 'Week 8 Revision',
          startsAt: '2026-03-25T19:00:00',
          endsAt: '2026-03-25T21:00:00',
          meetingLink: 'https://example.test/session/1',
        },
      ],
    },
  ];

  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        firstName: 'Alicia',
        lastName: 'Ng',
        avatarUrl: '',
      }),
    })
  );

  await page.route('**/api/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        firstName: 'Alicia',
        lastName: 'Ng',
        avatarUrl: '',
      }),
    })
  );

  await page.route('**/api/groups', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(groups.map(({ members, sessions, ...group }) => group)),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const payload = JSON.parse(route.request().postData() ?? '{}');
      const createdGroup: Group = {
        id: `group-${groups.length + 1}`,
        memberCount: 1,
        joined: true,
        membershipStatus: 'approved',
        isAdmin: true,
        status: 'active',
        createdBy: 'user-1',
        members: [
          {
            userId: 'user-1',
            email: 'owner@u.nus.edu',
            role: 'owner',
            membershipStatus: 'approved',
            firstName: 'Alicia',
            lastName: 'Ng',
          },
        ],
        sessions: [],
        ...payload,
      };
      groups.unshift(createdGroup);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createdGroup),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/groups/*', async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split('/').filter(Boolean);
    const groupId = segments[segments.length - 1];
    const group = groups.find((entry) => entry.id === groupId);

    if (!group) {
      await route.fulfill({ status: 404, body: 'Not found' });
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(group),
      });
      return;
    }

    if (route.request().method() === 'PUT') {
      const payload = JSON.parse(route.request().postData() ?? '{}');
      Object.assign(group, payload);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(group),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/groups/*/join', async (route) => {
    const groupId = route.request().url().split('/').slice(-2, -1)[0];
    const group = groups.find((entry) => entry.id === groupId);

    if (!group) {
      await route.fulfill({ status: 404, body: 'Not found' });
      return;
    }

    group.joined = true;
    group.membershipStatus = group.membershipStatus === 'pending' ? 'pending' : 'approved';
    group.memberCount += 1;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memberCount: group.memberCount }),
    });
  });

  await page.route('**/api/groups/*/leave', async (route) => {
    const groupId = route.request().url().split('/').slice(-2, -1)[0];
    const group = groups.find((entry) => entry.id === groupId);

    if (!group) {
      await route.fulfill({ status: 404, body: 'Not found' });
      return;
    }

    group.joined = false;
    group.membershipStatus = 'not_joined';
    group.memberCount = Math.max(0, group.memberCount - 1);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memberCount: group.memberCount }),
    });
  });
}

test.describe('Study groups dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await stubDashboardApi(page);
  });

  test('renders fetched groups and current user details', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Study Groups' })).toBeVisible();
    await expect(page.getByText('Discover, create, and join study groups')).toBeVisible();
    await expect(page.getByText('CS2030 Debugging Circle')).toBeVisible();
    await expect(page.getByText('CS2100 Midterm Prep')).toBeVisible();
    await expect(page.getByText('Alicia Ng')).toBeVisible();
  });

  test('filters visible groups from the dashboard search input', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/search by name, course code, or topic/i).fill('CS2100');

    await expect(page.getByText('CS2100 Midterm Prep')).toBeVisible();
    await expect(page.getByText('CS2030 Debugging Circle')).toHaveCount(0);
  });

  test('creates a new online study group from the modal', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /create group/i }).click();
    const modal = page.locator('.modalCard');
    await modal.getByLabel(/group name/i).fill('CS3230 Problem Solving');
    await modal.getByPlaceholder(/e\.g\. CS2030/i).fill('CS3230');
    await modal.getByLabel(/^topic$/i).fill('Greedy algorithms');
    await modal.getByLabel(/preferred schedule/i).fill('Mon 8-10pm');
    await modal.getByLabel(/meeting link/i).fill('https://example.test/room/cs3230');
    await modal.getByLabel(/description/i).fill('Weekly practice for contest-style questions.');
    await modal.getByRole('button', { name: 'Create Group' }).click();

    await expect(page.getByText('CS3230 Problem Solving')).toBeVisible();
    await expect(page.getByText('Greedy algorithms')).toBeVisible();
  });

  test('joins and leaves a public group from the card action', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('.groupCard').filter({ hasText: 'CS2030 Debugging Circle' });
    await expect(card.getByRole('button', { name: 'Join' })).toBeVisible();
    await expect(card.getByText('3/8 members')).toBeVisible();

    await card.getByRole('button', { name: 'Join' }).click();
    await expect(card.getByRole('button', { name: 'Leave' })).toBeVisible();
    await expect(card.getByText('4/8 members')).toBeVisible();

    await card.getByRole('button', { name: 'Leave' }).click();
    await expect(card.getByRole('button', { name: 'Join' })).toBeVisible();
    await expect(card.getByText('3/8 members')).toBeVisible();
  });

  test('opens the manage modal for admin-owned groups', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('.groupCard').filter({ hasText: 'CS2100 Midterm Prep' });
    await card.getByRole('button', { name: 'Manage' }).click();

    await expect(page.getByRole('heading', { name: /manage group: cs2100 midterm prep/i })).toBeVisible();
    await expect(page.getByText('Week 8 Revision')).toBeVisible();
    await expect(page.getByText('pending@u.nus.edu')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Group' })).toBeVisible();
  });
});
