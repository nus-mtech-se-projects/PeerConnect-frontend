import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('navigates to About/Contact page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'About / Contact' }).click();
    await expect(page).toHaveURL('/contact');
    await expect(page.getByText('Who are we?')).toBeVisible();
  });

  test('navigates to Login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('navigates to Signup page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/signup');
  });

  test('unknown route redirects to home', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page).toHaveURL('/');
  });

  test('logo click navigates to home', async ({ page }) => {
    await page.goto('/login');
    await page.locator('.brandPro').click();
    await expect(page).toHaveURL('/');
  });
});
