import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { requireEnv } from '../server/env';

let adminClient: SupabaseClient | undefined;

/** Service-role client for server routes that bypass RLS (webhooks, admin writes). */
export function createSupabaseAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      requireEnv('PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return adminClient;
}
