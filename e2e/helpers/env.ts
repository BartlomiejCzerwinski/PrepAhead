import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(filePath: string): void {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));
loadEnvFile(resolve(process.cwd(), '.env'));

/** Placeholder Payment Link for local E2E when STRIPE_PAYMENT_LINK_URL is unset. */
export const E2E_DEFAULT_STRIPE_PAYMENT_LINK =
  'https://buy.stripe.com/test_e2e_placeholder';

export type E2EEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string | null;
  baseURL: string;
  testEmail: string;
  testPassword: string;
  stripePaymentLinkUrl: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `E2E requires ${name}. Set it in .env.local (see .env.example).`,
    );
  }
  return value;
}

export function loadE2EEnv(): E2EEnv {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;

  return {
    supabaseUrl: requireEnv('PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: requireEnv('PUBLIC_SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: serviceRole,
    baseURL: process.env.PLAYWRIGHT_BASE_URL?.trim() || 'http://localhost:4321',
    testEmail: process.env.E2E_TEST_EMAIL?.trim() || 'e2e-delete@example.com',
    testPassword: process.env.E2E_TEST_PASSWORD?.trim() || 'E2e-Delete-Test-9x!',
    stripePaymentLinkUrl:
      process.env.STRIPE_PAYMENT_LINK_URL?.trim() || E2E_DEFAULT_STRIPE_PAYMENT_LINK,
  };
}

export function requireStripePaymentLinkUrl(env: E2EEnv): string {
  return env.stripePaymentLinkUrl ?? E2E_DEFAULT_STRIPE_PAYMENT_LINK;
}

export function requireServiceRoleKey(env: E2EEnv): string {
  if (!env.supabaseServiceRoleKey) {
    throw new Error(
      'E2E user bootstrap needs SUPABASE_SERVICE_ROLE_KEY in .env.local, or create the E2E test user manually in Supabase (email/password) and enable the Email provider.',
    );
  }
  return env.supabaseServiceRoleKey;
}
