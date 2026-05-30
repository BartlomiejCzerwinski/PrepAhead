import { createBrowserClient as supabaseCreateBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Browser-only Supabase client for future React islands (S-01+). Form-based OAuth in F-03 does not use this. */
export function createBrowserClient(): SupabaseClient {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
  }

  return supabaseCreateBrowserClient(url, anonKey);
}
