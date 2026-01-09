import { test, expect } from '@playwright/test';

test('App loads and shows dashboard', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=Dashboard')).toBeVisible();
});
