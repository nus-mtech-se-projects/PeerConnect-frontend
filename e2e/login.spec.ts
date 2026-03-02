import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. johntan@u.nus.edu or A1234567X')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Microsoft' })).toBeVisible();
  });

  test('shows error when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.locator('.authError')).toHaveText(
      'Please enter your email/NUS Student ID and password.'
    );
  });

  test('shows error on invalid credentials (mocked)', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 401, body: 'Unauthorized' })
    );
    await page.getByPlaceholder('e.g. johntan@u.nus.edu or A1234567X').fill('wrong@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.locator('.authError')).toHaveText('Invalid credentials.');
  });

  test('redirects to dashboard on successful login (mocked)', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'fake.jwt.token' }),
      })
    );
    await page.getByPlaceholder('e.g. johntan@u.nus.edu or A1234567X').fill('test@u.nus.edu');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('has link to signup page', async ({ page }) => {
    await page.getByRole('link', { name: 'Create one' }).click();
    await expect(page).toHaveURL('/signup');
  });

  test('has link to forgot password page', async ({ page }) => {
    await page.getByRole('link', { name: 'Click here' }).click();
    await expect(page).toHaveURL('/forgot-password');
  });
});
