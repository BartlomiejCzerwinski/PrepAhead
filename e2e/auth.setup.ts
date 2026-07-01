import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { test as setup, expect, type Cookie } from '@playwright/test';

import { sessionToPlaywrightCookies } from './helpers/auth-cookies';
import { loadE2EEnv } from './helpers/env';
import { signInE2EUser } from './helpers/supabase';

const authFile = resolve(process.cwd(), 'e2e/.auth/user.json');

async function validateAuthenticatedApp(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/app');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('link', { name: /Your practice sets/i })).toBeVisible();
}

setup('authenticate E2E test user', async ({ page }) => {
  const env = loadE2EEnv();
  mkdirSync(dirname(authFile), { recursive: true });

  // Path A: email/password test user (needs Email provider + optional service role bootstrap)
  try {
    const { session } = await signInE2EUser();
    const cookies = sessionToPlaywrightCookies(session, env.supabaseUrl);
    await page.context().addCookies(cookies);
    await validateAuthenticatedApp(page);
    await page.context().storageState({ path: authFile });
    return;
  } catch (emailAuthError) {
    // Fall through to saved Google OAuth storage state.
  }

  // Path B: reuse manually saved Google OAuth storage (email auth disabled on project)
  if (existsSync(authFile)) {
    const saved = JSON.parse(readFileSync(authFile, 'utf8')) as {
      cookies?: Cookie[];
    };
    if (saved.cookies?.length) {
      await page.context().addCookies(saved.cookies);
      await validateAuthenticatedApp(page);
      return;
    }
  }

  throw new Error(
    [
      'E2E auth setup failed.',
      '',
      'Option 1 — Email test user (CI-friendly):',
      '  • Enable the Email provider in Supabase Auth',
      '  • Set SUPABASE_SERVICE_ROLE_KEY in .env.local for automatic test-user bootstrap',
      '',
      'Option 2 — Google OAuth (local, one-time):',
      '  • npm run dev',
      '  • npx playwright codegen http://localhost:4321/login --save-storage=e2e/.auth/user.json',
      '  • Sign in with Google, reach /app, close the recorder',
      '  • Re-run npm run test:e2e',
    ].join('\n'),
  );
});
