import { defineConfig, devices } from '@playwright/test';

import { loadE2EEnv } from './e2e/helpers/env';

const env = loadE2EEnv();
const e2ePort = Number(process.env.PLAYWRIGHT_PORT ?? 4333);
const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || `http://localhost:${e2ePort}`;
const authFile = 'e2e/.auth/user.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /billing-.*\.spec\.ts/],
    },
    {
      name: 'chromium-billing',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testMatch: /billing-.*\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${e2ePort}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PUBLIC_SITE_URL: baseURL,
      STRIPE_PAYMENT_LINK_URL: env.stripePaymentLinkUrl,
    },
  },
});
