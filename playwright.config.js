import { defineConfig } from '@playwright/test';

// If you have a global setup file, import its path
import { fileURLToPath } from 'url';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    storageState: 'playwright/.auth/user.json',
  },
  // Use `fileURLToPath` for ES module compatibility
  globalSetup: fileURLToPath(new URL('./global-setup.js', import.meta.url)),
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});