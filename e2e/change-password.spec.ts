import { test, expect } from '@playwright/test';

// Helper: set a token so the private route allows access
async function authenticate(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('accessToken', 'fake.jwt.token'));
}

test.describe('ChangePassword page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  test('renders heading and sends code on mount (mocked)', async ({ page }) => {
    await page.route('**/api/auth/change-password/request', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.goto('/change-password');

    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
    await expect(page.locator('.authSuccess')).toContainText('verification code has been sent');
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();
  });

  test('shows error banner when mount code request fails (mocked)', async ({ page }) => {
    await page.route('**/api/auth/change-password/request', (route) =>
      route.fulfill({ status: 500, body: 'Server error' })
    );
    await page.goto('/change-password');

    await expect(page.locator('.authError')).toHaveText('Server error');
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();
  });

  // ── Form Validation ─────────────────────────────────────────────────────────

  test('shows validation errors on submit', async ({ page }) => {
    await page.route('**/api/auth/change-password/request', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.goto('/change-password');
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    // empty code
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.locator('.authError')).toHaveText('Please enter the verification code.');

    // fill code, empty password
    await page.getByPlaceholder('Enter 6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.locator('.authError')).toHaveText('Please enter a new password.');

    // password too short
    await page.getByPlaceholder('New password', { exact: true }).fill('abc');
    await page.getByPlaceholder('Retype new password').fill('abc');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.locator('.authError')).toHaveText('Password must be at least 6 characters.');

    // passwords don't match
    await page.getByPlaceholder('New password', { exact: true }).fill('pass123');
    await page.getByPlaceholder('Retype new password').fill('different');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.locator('.authError')).toHaveText('Passwords do not match.');
  });

  // ── Success ─────────────────────────────────────────────────────────────────

  test('shows success and redirects to profile on change (mocked)', async ({ page }) => {
    await page.route('**/api/auth/change-password/request', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.route('**/api/auth/change-password/confirm', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.goto('/change-password');
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    await page.getByPlaceholder('Enter 6-digit code').fill('123456');
    await page.getByPlaceholder('New password', { exact: true }).fill('newpass1');
    await page.getByPlaceholder('Retype new password').fill('newpass1');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.locator('.authSuccess')).toContainText('Password changed successfully');
    await expect(page).toHaveURL('/profile', { timeout: 5000 });
  });

  // ── Failure ─────────────────────────────────────────────────────────────────

  test('shows error on invalid/expired code (mocked)', async ({ page }) => {
    await page.route('**/api/auth/change-password/request', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.route('**/api/auth/change-password/confirm', (route) =>
      route.fulfill({ status: 400, body: 'Invalid or expired code.' })
    );
    await page.goto('/change-password');
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    await page.getByPlaceholder('Enter 6-digit code').fill('000000');
    await page.getByPlaceholder('New password', { exact: true }).fill('newpass1');
    await page.getByPlaceholder('Retype new password').fill('newpass1');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.locator('.authError')).toHaveText('Invalid or expired code.');
  });

  // ── Resend ──────────────────────────────────────────────────────────────────

  test('resend button re-calls the request endpoint (mocked)', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/auth/change-password/request', (route) => {
      callCount++;
      route.fulfill({ status: 200, body: '' });
    });
    await page.goto('/change-password');
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    await page.getByRole('button', { name: 'Resend verification code' }).click();
    await expect(page.locator('.authSuccess')).toContainText('new verification code has been sent');
    expect(callCount).toBe(2);
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test('Back to Profile button navigates to /profile', async ({ page }) => {
    await page.route('**/api/auth/change-password/request', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.route('**/api/profile', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    );
    await page.goto('/change-password');
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    await page.getByRole('button', { name: /back to profile/i }).click();
    await expect(page).toHaveURL('/profile');
  });
});
