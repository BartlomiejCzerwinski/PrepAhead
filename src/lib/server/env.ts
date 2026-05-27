/** Server-only and public env keys used by API routes. Use static access — not dynamic indexing. */
export type EnvKey =
  | 'PUBLIC_SUPABASE_URL'
  | 'PUBLIC_SUPABASE_ANON_KEY'
  | 'PUBLIC_SITE_URL'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'OPENAI_API_KEY'
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET';

export class MissingEnvError extends Error {
  constructor(public readonly key: EnvKey) {
    super(`Missing required environment variable: ${key}`);
    this.name = 'MissingEnvError';
  }
}

function readEnv(key: EnvKey): string | undefined {
  switch (key) {
    case 'PUBLIC_SUPABASE_URL':
      return import.meta.env.PUBLIC_SUPABASE_URL;
    case 'PUBLIC_SUPABASE_ANON_KEY':
      return import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    case 'PUBLIC_SITE_URL':
      return import.meta.env.PUBLIC_SITE_URL;
    case 'SUPABASE_SERVICE_ROLE_KEY':
      return import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    case 'OPENAI_API_KEY':
      return import.meta.env.OPENAI_API_KEY;
    case 'STRIPE_SECRET_KEY':
      return import.meta.env.STRIPE_SECRET_KEY;
    case 'STRIPE_WEBHOOK_SECRET':
      return import.meta.env.STRIPE_WEBHOOK_SECRET;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

/** Returns a non-empty env value or throws. Server-only keys must not use PUBLIC_ unless client-safe. */
export function requireEnv(key: EnvKey): string {
  const value = readEnv(key)?.trim();
  if (!value) {
    throw new MissingEnvError(key);
  }
  return value;
}
