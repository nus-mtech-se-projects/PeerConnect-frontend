import { test, expect } from '@playwright/test';

test.describe('ForgotPassword page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  test('renders step 1 form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
    await expect(page.getByPlaceholder(/johntan@u\.nus\.edu or A1234567X/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send verification code' })).toBeVisible();
  });

  test('has link back to login', async ({ page }) => {
    await page.getByRole('main').getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL('/login');
  });

  // ── Step 1 Validation ───────────────────────────────────────────────────────

  test('shows error when submitting empty identifier', async ({ page }) => {
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.locator('.authError')).toHaveText(
      'Please enter your email or NUS Student ID.'
    );
  });

  // ── Step 1 Success → Step 2 ─────────────────────────────────────────────────

  test('advances to step 2 after successful code request (mocked)', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.getByPlaceholder(/johntan@u\.nus\.edu or A1234567X/i).fill('test@u.nus.edu');
    await page.getByRole('button', { name: 'Send verification code' }).click();

    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();
    await expect(page.getByPlaceholder('New password', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Retype new password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset password' })).toBeVisible();
  });

  // ── Step 1 Failure ──────────────────────────────────────────────────────────

  test('shows error when code request fails (mocked)', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) =>
      route.fulfill({ status: 404, body: 'User not found' })
    );
    await page.getByPlaceholder(/johntan@u\.nus\.edu or A1234567X/i).fill('unknown@u.nus.edu');
    await page.getByRole('button', { name: 'Send verification code' }).click();

    await expect(page.locator('.authError')).toHaveText('User not found');
  });

  // ── Step 2 Validation ───────────────────────────────────────────────────────

  test('shows step 2 validation errors', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.getByPlaceholder(/johntan@u\.nus\.edu or A1234567X/i).fill('test@u.nus.edu');
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    // empty code
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.locator('.authError')).toHaveText('Please enter the verification code.');

    // fill code, leave password empty
    await page.getByPlaceholder('Enter 6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.locator('.authError')).toHaveText('Please enter a new password.');

    // passwords don't match
    await page.getByPlaceholder('New password', { exact: true }).fill('pass123');
    await page.getByPlaceholder('Retype new password').fill('different');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.locator('.authError')).toHaveText('Passwords do not match.');

    // password too short
    await page.getByPlaceholder('New password', { exact: true }).fill('abc');
    await page.getByPlaceholder('Retype new password').fill('abc');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.locator('.authError')).toHaveText('Password must be at least 6 characters.');
  });

  // ── Step 2 Success ──────────────────────────────────────────────────────────

  test('shows success and redirects to login on reset (mocked)', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.route('**/api/auth/reset-password', (route) =>
      route.fulfill({ status: 200, body: '' })
    );

    await page.getByPlaceholder(/johntan@u\.nus\.edu or A1234567X/i).fill('test@u.nus.edu');
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    await page.getByPlaceholder('Enter 6-digit code').fill('123456');
    await page.getByPlaceholder('New password', { exact: true }).fill('newpass1');
    await page.getByPlaceholder('Retype new password').fill('newpass1');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.locator('.authSuccess')).toContainText('Password reset successfully');
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  // ── Step 2 Failure ──────────────────────────────────────────────────────────

  test('shows error on invalid/expired code (mocked)', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.route('**/api/auth/reset-password', (route) =>
      route.fulfill({ status: 400, body: 'Invalid or expired code.' })
    );

    await page.getByPlaceholder(/johntan@u\.nus\.edu or A1234567X/i).fill('test@u.nus.edu');
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    await page.getByPlaceholder('Enter 6-digit code').fill('000000');
    await page.getByPlaceholder('New password', { exact: true }).fill('newpass1');
    await page.getByPlaceholder('Retype new password').fill('newpass1');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.locator('.authError')).toHaveText('Invalid or expired code.');
  });

  // ── Back button ─────────────────────────────────────────────────────────────

  test('Back to enter email button returns to step 1', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, body: '' })
    );
    await page.getByPlaceholder(/johntan@u\.nus\.edu or A1234567X/i).fill('test@u.nus.edu');
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.getByPlaceholder('Enter 6-digit code')).toBeVisible();

    await page.getByRole('button', { name: /back to enter email/i }).click();
    await expect(page.getByRole('button', { name: 'Send verification code' })).toBeVisible();
  });
});
