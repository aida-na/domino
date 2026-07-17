import { expect, test } from '@playwright/test';

/**
 * Smoke: login UI is OTP-first with optional password.
 * Does not send a real OTP (avoids Blooio / daily-cap side effects).
 */
test.describe('login', () => {
  test('shows OTP sign-in and optional password path', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/phone number/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send code/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /use password/i })).toBeVisible();

    // Magic link should not be a primary mode anymore.
    await expect(page.getByRole('button', { name: /magic link/i })).toHaveCount(0);

    await page.getByRole('button', { name: /use password/i }).click();
    await expect(page.getByRole('heading', { name: /sign in with password/i })).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();

    await page.getByRole('button', { name: /use imessage code instead/i }).click();
    await expect(page.getByRole('button', { name: /send code/i })).toBeVisible();
  });

  test('landing get started links to login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const cta = page.getByRole('link', { name: /get started/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /send code/i })).toBeVisible();
  });
});
