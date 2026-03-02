import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders PeerConnect branding in navbar', async ({ page }) => {
    await expect(page.locator('.brandProName')).toHaveText('PeerConnect');
  });

  test('shows Login and Sign up buttons when logged out', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });

  test('renders all 4 feature cards', async ({ page }) => {
    const cards = page.locator('.featureRow');
    await expect(cards.getByText('Peer tutoring system')).toBeVisible();
    await expect(cards.getByText('Study Groups', { exact: true })).toBeVisible();
    await expect(cards.getByText('AI Chatbot')).toBeVisible();
    await expect(cards.getByText('Support System')).toBeVisible();
  });

  test('carousel shows first slide', async ({ page }) => {
    await expect(page.getByText('Find the right tutor')).toBeVisible();
  });
});
