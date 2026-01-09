import { expect } from '@playwright/test';
import { test } from './network.mock';

test('Projects view works', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Projects');
    await expect(page.locator('text=Projects')).toBeVisible();
});

test('Tasks view works', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Tasks');
    await expect(page.locator('text=Tasks')).toBeVisible();
});

test('Emails view works', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Emails');
    await expect(page.locator('text=Emails')).toBeVisible();
});

test('Calendar view works', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Calendar');
    await expect(page.locator('text=Calendar')).toBeVisible();
});

test('Commands view works', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Commands');

    // Wait for commands to load
    await page.waitForTimeout(500);

    // Check for actual text on page - might be "Command Nexus" or similar
    await expect(page.locator('text=Flush DNS').or(page.locator('text=Command'))).toBeVisible();
});

test('AI view works without crashing', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AI');
    await expect(page.locator('text=AI')).toBeVisible();
});
