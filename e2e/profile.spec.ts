import { test, expect } from '@playwright/test';

const EMPTY_PROFILE = {
  faculty: '',
  major: '',
  yearOfStudy: null,
  fullTime: true,
  bio: '',
  avatarUrl: '',
};

async function authenticate(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('accessToken', 'fake.jwt.token'));
}

async function gotoProfile(page, profileData = EMPTY_PROFILE) {
  await page.route('**/api/profile', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profileData),
      });
    } else {
      route.continue();
    }
  });
  await page.goto('/profile');
}

test.describe('Profile page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  test('renders profile form after load', async ({ page }) => {
    await gotoProfile(page);

    await expect(page.getByRole('combobox', { name: /faculty/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /major/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /year of study/i })).toBeVisible();
    await expect(page.getByPlaceholder(/tell others about yourself/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change Password' })).toBeVisible();
  });

  test('populates form fields from existing profile (mocked)', async ({ page }) => {
    await gotoProfile(page, {
      faculty: 'School of Computing',
      major: 'Computer Science',
      yearOfStudy: 2,
      fullTime: true,
      bio: 'I love coding',
      avatarUrl: '',
    });

    await expect(page.getByRole('combobox', { name: /faculty/i })).toHaveValue('School of Computing');
    await expect(page.getByRole('combobox', { name: /major/i })).toHaveValue('Computer Science');
    await expect(page.getByRole('combobox', { name: /year of study/i })).toHaveValue('2');
    await expect(page.getByPlaceholder(/tell others about yourself/i)).toHaveValue('I love coding');
  });

  // ── Faculty / Major cascade ──────────────────────────────────────────────────

  test('major select is disabled until faculty is chosen', async ({ page }) => {
    await gotoProfile(page);
    await expect(page.getByRole('combobox', { name: /major/i })).toBeDisabled();

    await page.getByRole('combobox', { name: /faculty/i }).selectOption('School of Computing');
    await expect(page.getByRole('combobox', { name: /major/i })).toBeEnabled();
  });

  test('changing faculty resets major', async ({ page }) => {
    await gotoProfile(page, {
      ...EMPTY_PROFILE,
      faculty: 'School of Computing',
      major: 'Computer Science',
    });

    await expect(page.getByRole('combobox', { name: /major/i })).toHaveValue('Computer Science');
    await page.getByRole('combobox', { name: /faculty/i }).selectOption('Faculty of Science');
    await expect(page.getByRole('combobox', { name: /major/i })).toHaveValue('');
  });

  // ── Save ────────────────────────────────────────────────────────────────────

  test('shows success message on save (mocked)', async ({ page }) => {
    await gotoProfile(page);
    await page.route('**/api/profile', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.locator('.profileSuccess')).toHaveText('Profile saved successfully!');
  });

  test('shows error message on save failure (mocked)', async ({ page }) => {
    await gotoProfile(page);
    await page.route('**/api/profile', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ status: 500 });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.locator('.profileError')).toContainText('Save failed');
  });

  // ── Avatar ──────────────────────────────────────────────────────────────────

  test('avatar drop zone is visible', async ({ page }) => {
    await gotoProfile(page);
    await expect(page.getByText('Click or drag image here')).toBeVisible();
    await expect(page.getByText('PNG / JPG — max 2 MB')).toBeVisible();
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test('Change Password button navigates to /change-password', async ({ page }) => {
    await gotoProfile(page);
    await page.route('**/api/auth/change-password/request', (route) =>
      route.fulfill({ status: 200, body: '' })
    );

    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page).toHaveURL('/change-password');
  });
});
