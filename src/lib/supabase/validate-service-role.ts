import { MissingEnvError, requireEnv } from '../server/env';

export function decodeJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export type ServiceRoleKeyValidation =
  | { ok: true }
  | { ok: false; code: string; message: string };

export function validateServiceRoleKey(): ServiceRoleKeyValidation {
  let key: string;
  let anonKey: string;

  try {
    key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    anonKey = requireEnv('PUBLIC_SUPABASE_ANON_KEY');
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return {
        ok: false,
        code: 'service_role_key_missing',
        message: error.message,
      };
    }

    throw error;
  }

  if (key === anonKey) {
    return {
      ok: false,
      code: 'service_role_key_is_anon',
      message:
        'SUPABASE_SERVICE_ROLE_KEY must be the service_role secret from Supabase Dashboard → API, not the anon key.',
    };
  }

  const role = decodeJwtRole(key);
  if (role !== 'service_role') {
    return {
      ok: false,
      code: 'service_role_key_invalid_role',
      message: `SUPABASE_SERVICE_ROLE_KEY JWT role is "${role ?? 'unknown'}", expected service_role.`,
    };
  }

  return { ok: true };
}
