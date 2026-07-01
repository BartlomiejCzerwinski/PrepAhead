import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

import { loadE2EEnv, requireServiceRoleKey } from './env';
import { sessionFromStorageState } from './session-from-state';

export function createAdminClient(): SupabaseClient {
  const env = loadE2EEnv();
  return createClient(env.supabaseUrl, requireServiceRoleKey(env), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAnonClient(): SupabaseClient {
  const env = loadE2EEnv();
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getAuthenticatedClient(): Promise<{
  client: SupabaseClient;
  user: User;
}> {
  const env = loadE2EEnv();

  try {
    const { client, user } = await signInE2EUser();
    return { client, user };
  } catch {
    const session = await sessionFromStorageState(env.supabaseUrl);
    if (!session?.user) {
      throw new Error('No authenticated E2E session. Run auth.setup first.');
    }

    const client = createAnonClient();
    const { data, error } = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error || !data.user) {
      throw error ?? new Error('Saved E2E session is expired — re-run codegen save-storage.');
    }

    return { client, user: data.user };
  }
}

export async function signInE2EUser(): Promise<{
  client: SupabaseClient;
  session: Session;
  user: User;
}> {
  const env = loadE2EEnv();
  const client = createAnonClient();

  let { data, error } = await client.auth.signInWithPassword({
    email: env.testEmail,
    password: env.testPassword,
  });

  if (error || !data.session || !data.user) {
    await ensureE2ETestUserViaAdmin();
    ({ data, error } = await client.auth.signInWithPassword({
      email: env.testEmail,
      password: env.testPassword,
    }));
  }

  if (error || !data.session || !data.user) {
    throw (
      error ??
      new Error(
        'E2E email sign-in unavailable. Enable the Email provider or save Google OAuth storage state.',
      )
    );
  }

  return { client, session: data.session, user: data.user };
}

async function ensureE2ETestUserViaAdmin(): Promise<User> {
  const env = loadE2EEnv();
  const admin = createAdminClient();

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) {
    throw listError;
  }

  const existing = listed.users.find((user) => user.email === env.testEmail);
  if (existing) {
    return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: env.testEmail,
    password: env.testPassword,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error('Failed to create E2E test user');
  }

  return data.user;
}

export async function ensureE2ETestUser(): Promise<User> {
  const { user } = await getAuthenticatedClient();
  return user;
}

export async function createOwnedPracticeSet(
  userId: string,
  title: string,
): Promise<string> {
  const { client } = await getAuthenticatedClient();

  const { data, error } = await client
    .from('practice_sets')
    .insert({
      user_id: userId,
      title,
      job_description_text: 'E2E fixture job description for delete flow.',
      content: {},
      status: 'in_progress',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to seed practice set for E2E');
  }

  return data.id;
}

export async function cleanupPracticeSet(
  practiceSetId: string,
  options: { hard?: boolean } = {},
): Promise<void> {
  const env = loadE2EEnv();

  if (options.hard && env.supabaseServiceRoleKey) {
    const admin = createAdminClient();
    const { error } = await admin.from('practice_sets').delete().eq('id', practiceSetId);
    if (!error) {
      return;
    }
  }

  const { client } = await getAuthenticatedClient();
  await client
    .from('practice_sets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', practiceSetId);
}
