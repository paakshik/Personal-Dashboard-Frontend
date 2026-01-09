import { test as base } from '@playwright/test';

export const test = base.extend({
    context: async ({ context }, use) => {
        // 🚀 INJECT BEFORE SCRIPT EXECUTION
        // This stops the app from seeing 'null' and redirecting to /login
        await context.addInitScript(() => {
            window.localStorage.setItem('token', 'MOCK_GOOGLE_LEVEL_TOKEN');
            window.localStorage.setItem('user', JSON.stringify({
                id: 'user_123',
                email: 'engineer@google.com',
                name: 'Senior Dev',
                role: 'admin'
            }));
        });

        await use(context);
    },
});