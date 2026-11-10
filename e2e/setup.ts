import {test as base} from '@playwright/test';

export const test = base.extend({
    page: async ({page}, use) => {
        await page.addInitScript(() => {
            localStorage.setItem('token', 'MOCK_TEST_TOKEN');
            localStorage.setItem('user', JSON.stringify({
                id: 'user_123',
                name: 'Test User',
                email: 'tester@example.com'
            }));
        });
        await use(page);
    },
});
