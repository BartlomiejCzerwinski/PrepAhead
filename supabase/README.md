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

## Without Docker locally

If Docker is unavailable, you can still ship schema changes by committing migrations and merging to `prod` (see **Remote environments**). Supabase GitHub integration applies migrations to the hosted project; production deploy skips seed data on protected branches. Use Docker + `db reset` when you need a full local stack for development.

## Remote environments

F-02 commits migrations only. Linking a hosted Supabase project and applying migrations to Preview/Production is documented in `context/deployment/deploy-plan.md`. **App deploys on Vercel do not roll back database changes.**
