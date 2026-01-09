import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for the redirect to finish (so cookies are saved)
    await page.waitForURL('**/dashboard');

    // Save the signed-in state to a file
    await page.context().storageState({ path: 'playwright/.auth/user.json' });
});