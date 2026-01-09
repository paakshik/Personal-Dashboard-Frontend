import { expect } from '@playwright/test';
import { test } from '../e2e/network.mock.ts';

test('should render system operational status and stats', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // From your snapshot, the heading is "Hello Paakshik!" not "Dashboard"
    await expect(page.getByRole('heading', { name: /Hello Paakshik!/i })).toBeVisible();

    // Check for operational status
    await expect(page.locator('text=Operational')).toBeVisible();

    // Check for mock data
    await expect(page.locator('text=42.5%').first()).toBeVisible();
    await expect(page.locator('text=55%').first()).toBeVisible();
});