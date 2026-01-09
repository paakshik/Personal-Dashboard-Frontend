// global-setup.js
import { chromium } from '@playwright/test';

async function globalSetup() {
    // Launch a persistent browser context for setup tasks
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Go to your application
    await page.goto('http://localhost:5173');

    // Set authentication tokens directly in localStorage
    await page.evaluate(() => {
        globalThis.localStorage.setItem('token', 'MOCK_GOOD_TOKEN');
        globalThis.localStorage.setItem('user', JSON.stringify({
            id: 'user_123',
            email: 'engineer@google.com',
            name: 'Senior Dev',
            role: 'admin'
        }));
        globalThis.localStorage.setItem('authenticated', 'true');
    });

    // Save the authentication state to a file
    await context.storageState({ path: 'playwright/.auth/user.json' });

    // Close the browser
    await browser.close();
}

// Export the function for Playwright to execute
export default globalSetup;