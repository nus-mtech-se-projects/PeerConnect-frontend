import { test, expect } from '@playwright/test';

test.describe('Auth guard (private routes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('accessToken'));
  });

  test('redirects /change-password to /login when not authenticated', async ({ page }) => {
    await page.goto('/change-password');
    await expect(page).toHaveURL('/login');
  });

  test('redirects /profile to /login when not authenticated', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/login');
  });

  test('allows access to /profile when token is set', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('accessToken', `eyJhbGciOiJub25lIn0.${btoa(JSON.stringify({exp:9999999999,sub:'test'}))}.sig`)
    );
    await page.goto('/profile');
    await expect(page).not.toHaveURL('/login');
  });

  test('allows access to /change-password when token is set', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('accessToken', `eyJhbGciOiJub25lIn0.${btoa(JSON.stringify({exp:9999999999,sub:'test'}))}.sig`)
    );
    await page.goto('/change-password');
    await expect(page).not.toHaveURL('/login');
  });

  test('/forgot-password is accessible without authentication', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page).toHaveURL('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
  });
});
