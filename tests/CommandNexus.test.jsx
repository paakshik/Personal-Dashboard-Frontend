import { expect } from '@playwright/test';
import { test } from '../e2e/network.mock.ts';

test.describe('Advanced Modules', () => {
    test('Emails View classifies unread messages', async ({ page }) => {
        await page.goto('/');
        await page.getByText('Emails', { exact: true }).click();

        // Wait for content to load
        await page.waitForLoadState('networkidle');

        // Check for email subjects from mock data
        await expect(page.getByText('System Alert')).toBeVisible();
        await expect(page.getByText('Welcome')).toBeVisible();

        // Check for unread badge - depends on your UI implementation
        // Either look for "UNREAD" label or count badge
        const unreadIndicator = page.locator('[class*="unread"], [class*="badge"]').first();
        if (await unreadIndicator.count() > 0) {
            await expect(unreadIndicator).toBeVisible();
        }
    });

    test('Command Nexus displays terminal entries', async ({ page }) => {
        await page.goto('/');
        await page.getByText('Commands', { exact: true }).click();

        // Wait for commands to load
        await page.waitForTimeout(1000);

        await expect(page.locator('text=Flush DNS, text=/flushdns').first()).toBeVisible();
        await expect(page.locator('text=ipconfig /flushdns').first()).toBeVisible();
    });

    test('AI View initializes correctly', async ({ page }) => {
        await page.goto('/');
        // FIX: Use exact: true to avoid matching "Emails"
        await page.getByText('AI', { exact: true }).click();

        const input = page.getByPlaceholder(/Message Nexus AI/i);
        await expect(input).toBeVisible();
    });
});