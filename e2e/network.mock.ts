import { test as base } from './setup';

export const test = base.extend({
    page: async ({ page }, use) => {
        // 1. Intercept auth verification - FIXED endpoint
        await page.route('**/auth/verify', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    authenticated: true,
                    user: {
                        id: 'user_123',
                        name: 'Senior Dev',
                        email: 'engineer@google.com',
                        role: 'admin'
                    }
                }),
            });
        });

        // 2. MOCK ACTUAL BACKEND ENDPOINTS (from main.py)

        // ✅ Match your actual endpoint: /dashboard/system/simple/vitals
        await page.route('**/dashboard/system/simple/vitals', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    cpu_usage: 42.5,
                    memory_usage: 55,
                    disk_usage: 65,
                    boot_time: new Date().toISOString(),
                    platform: "MockOS"
                })
            });
        });

        // ✅ Match your actual endpoint: /dashboard/gmail
        await page.route('**/dashboard/gmail', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: '1',
                        subject: 'System Alert',
                        sender: 'admin@system.com',
                        date: '2024-01-15T10:30:00Z',
                        snippet: 'This is a system alert email',
                        labels: ['UNREAD', 'INBOX']
                    },
                    {
                        id: '2',
                        subject: 'Welcome',
                        sender: 'team@company.com',
                        date: '2024-01-14T14:20:00Z',
                        snippet: 'Welcome to the platform',
                        labels: ['INBOX']
                    }
                ])
            });
        });

        // ✅ Match your actual endpoint: /dashboard/todoist
        await page.route('**/dashboard/todoist', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: '1',
                        content: 'Finish Playwright Suite',
                        description: 'Complete the test suite',
                        is_completed: false,
                        priority: 4
                    },
                    {
                        id: '2',
                        content: 'Fix API endpoints',
                        description: 'Fix the mismatched endpoints',
                        is_completed: false,
                        priority: 3
                    }
                ])
            });
        });

        // ✅ Match your actual endpoint: /dashboard/commands
        await page.route('**/dashboard/commands', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: '1',
                        name: 'Flush DNS',
                        command: 'ipconfig /flushdns',
                        description: 'Clears DNS resolver cache',
                        category: 'network',
                        created_at: new Date().toISOString()
                    },
                    {
                        id: '2',
                        name: 'Clear Cache',
                        command: 'npm cache clean --force',
                        description: 'Clears npm cache',
                        category: 'development',
                        created_at: new Date().toISOString()
                    }
                ])
            });
        });

        // ✅ Match your actual endpoint: /dashboard/projects
        await page.route('**/dashboard/projects', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    projects: [
                        {
                            id: '1',
                            name: 'Project Alpha',
                            status: 'active',
                            description: 'Test project',
                            progress: 75,
                            technologies: ['React', 'Node.js']
                        },
                        {
                            id: '2',
                            name: 'Playwright Tests',
                            status: 'in-progress',
                            description: 'Testing framework',
                            progress: 30,
                            technologies: ['Playwright', 'TypeScript']
                        }
                    ],
                    stats: {
                        total: 2,
                        inProgress: 1,
                        completed: 0,
                        planning: 1,
                        avgProgress: 52
                    }
                })
            });
        });

        // 3. Mock other system endpoints
        await page.route('**/dashboard/system/ports', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify([
                    { port: 8000, process: 'FastAPI', service: 'API Server' },
                    { port: 5173, process: 'Vite', service: 'Frontend Dev' }
                ])
            });
        });

        await page.route('**/dashboard/system/processes', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify([
                    { pid: 123, name: 'node', cpu: 2.5, memory: 1.2 },
                    { pid: 456, name: 'python', cpu: 1.8, memory: 0.8 }
                ])
            });
        });

        // 4. Mock calendar endpoint
        await page.route('**/dashboard/calendar', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        date_key: '2024-01-15',
                        date_display: 'Monday, January 15, 2024',
                        events: [
                            {
                                id: '1',
                                title: 'Team Meeting',
                                time: '10:00',
                                location: 'Conference Room A'
                            }
                        ]
                    }
                ])
            });
        });

        // 5. Block any unmocked API calls to prevent real requests
        await page.route('**/api/**', async (route) => {
            console.log(`Blocking unmocked API: ${route.request().url()}`);
            return route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Endpoint not mocked' })
            });
        });

        await use(page);
    },
});