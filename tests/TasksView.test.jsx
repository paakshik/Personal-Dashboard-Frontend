import { expect } from '@playwright/test';
import { test } from '../e2e/network.mock.ts';

test('Tasks View displays Todoist items', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Tasks').click();

    await expect(page.getByRole('button', { name: /Add Task/i })).toBeVisible();
    await expect(page.getByText('Finish Playwright Suite')).toBeVisible();
});