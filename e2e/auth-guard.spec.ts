import { test, expect } from '@playwright/test';

test.describe('Auth guard (private routes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('accessToken'));
  });

  test('redirects /dashboard to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('redirects /profile to /login when not authenticated', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/login');
  });

  test('allows access to /dashboard when token is set', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('accessToken', 'fake.jwt.token')
    );
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL('/login');
  });
});
