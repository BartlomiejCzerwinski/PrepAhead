# Supabase (local schema)

Schema is managed with the [Supabase CLI](https://supabase.com/docs/guides/cli) and SQL migrations in `migrations/`.

## Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) running (required for `supabase start`)

## Commands (from repo root)

```bash
npx supabase start          # local Postgres + Auth + Studio
npx supabase db reset       # apply all migrations from scratch
npx supabase stop           # stop local stack
```

Local Studio URL is printed after `supabase start` (typically http://127.0.0.1:54323).

## Remote environments

F-02 commits migrations only. Linking a hosted Supabase project and applying migrations to Preview/Production is documented in `context/deployment/deploy-plan.md`. **App deploys on Vercel do not roll back database changes.**
