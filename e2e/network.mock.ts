import {test as base} from './setup';

export {expect} from '@playwright/test';

export const test = base.extend({
    page: async ({page}, use) => {
        const fulfill = (url, body) => page.route(url, (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body)
        }));
        await fulfill('**/dashboard/auth/google/verify', {
            valid: true,
            user: {id: 'user_123', name: 'Test User', email: 'tester@example.com'}
        });
        await fulfill('**/dashboard/calendar/events', []);
        await fulfill('**/dashboard/todoist', []);
        await fulfill('**/dashboard/gmail', []);
        await fulfill('**/dashboard/projects', {
            projects: [],
            stats: {total: 0, inProgress: 0, completed: 0, planning: 0, avgProgress: 0}
        });
        await fulfill('**/dashboard/commands', [{
            id: 'cmd-1',
            name: 'Flush DNS',
            command: 'ipconfig /flushdns',
            description: 'Clears DNS cache',
            category: 'network',
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }]);
        await fulfill('**/dashboard/system/current', {cpu: {percent: 12}, memory: {percent: 40}, disk: {percent: 50}});
        await fulfill('**/dashboard/gemini/history', []);
        await page.route('**/dashboard/auth/google/logout', (route) => route.fulfill({
            status: 200,
            json: {message: 'ok'}
        }));
        await use(page);
    },
});
