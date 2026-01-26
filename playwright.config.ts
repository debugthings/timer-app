import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: './backend',
      url: 'http://localhost:3001/api/admin/settings',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npm run dev',
      cwd: './frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
