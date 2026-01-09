import { expect } from '@playwright/test';
import { test } from '../e2e/network.mock.ts';

test('Project Dashboard renders list and controls', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Projects').click();

    // Check for the "New Project" button from ProjectDashboard.jsx
    await expect(page.getByRole('button', { name: /New Project/i })).toBeVisible();

    // Check for our mocked project
    await expect(page.getByText('Project Alpha')).toBeVisible();
});