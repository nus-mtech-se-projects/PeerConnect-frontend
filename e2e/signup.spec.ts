import { test, expect } from '@playwright/test';

test.describe('Signup page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('renders all signup fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await expect(page.getByLabel('NUS Student ID')).toBeVisible();
    await expect(page.getByLabel('First Name')).toBeVisible();
    await expect(page.getByLabel('Last Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Phone')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Microsoft' })).toBeVisible();
  });

  test('shows error when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('.authError')).toHaveText('Please fill in all fields.');
  });

  test('redirects to login on successful registration (mocked)', async ({ page }) => {
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'User registered' }),
      })
    );
    await page.getByLabel('NUS Student ID').fill('A1234567X');
    await page.getByLabel('First Name').fill('John');
    await page.getByLabel('Last Name').fill('Tan');
    await page.getByLabel('Email').fill('john@u.nus.edu');
    await page.getByLabel('Phone').fill('91234567');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('has link back to login', async ({ page }) => {
    await page.getByRole('main').getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL('/login');
  });
});
