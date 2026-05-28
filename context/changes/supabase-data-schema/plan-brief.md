# Supabase data schema — Plan Brief

> Full plan: `context/changes/supabase-data-schema/plan.md`

## What & Why

Add a Supabase Postgres schema + RLS policies and a committed migrations workflow so PrepAhead can persist per-user plan tier, **rolling-period** usage limits, practice sets (JD-grounded, with title + JSONB content), and theme preference. This is the persistence foundation required before OAuth, generation, Check, and billing can be implemented safely.

## Starting Point

The repo currently has **no Supabase client usage** and **no schema/migrations** checked in. Env var names and server-only conventions already exist (`.env.example`, `src/lib/server/env.ts`, and `src/pages/api/*` patterns).

## Desired End State

We can run `npx supabase start && npx supabase db reset` locally to apply migrations that create all required tables with **RLS enabled** and correct per-user isolation. The schema supports future slices: OAuth sign-in, usage dashboard, practice generation/storage, Check feedback, deletion, and theme persistence.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| User identity key | Supabase Auth `user.id` (uuid) | Stable canonical identity for all per-user data; avoids email-as-key issues. |
| Plan tier storage | `plan_tier` stored in DB (default FREE) | Enables later Stripe webhooks to update tier without deriving on every request. |
| Usage metering model | `usage_periods` — rolling month from signup anchor | Fair periods (join 15 May → resets 15 Jun), not calendar month. |
| Period anchor | `profiles.created_at` (optional `usage_period_anchor` later) | Signup date defines period boundaries without extra UX. |
| Sensitive inputs (JD/CV) | Store raw JD + optional CV with strict RLS | Required to keep practice sets grounded; data isolation enforced by policies. |
| Theme persistence | `user_settings` table | Clean separation of settings from profile; supports per-user cross-device preference. |
| Practice set structure | Single `practice_sets` row + `content jsonb` | Simpler MVP; one read/write for session state; no question/answer/check tables. |
| Practice set title | `practice_sets.title` (required) | Human-readable label for history and dashboard lists. |
| Delete behavior | Soft delete (`deleted_at`) for practice sets | Supports user deletion while allowing safe cleanup strategies later. |
| Migrations | Supabase CLI migrations committed in repo | Canonical, repeatable workflow for schema changes. |
| Service role key use | Server admin-only ops | Minimizes blast radius; normal access should use user sessions later. |
| RLS | Enabled on all app tables | Meets NFR data isolation and prevents cross-user leakage by default. |
| Profile bootstrap | `handle_new_user` trigger on `auth.users` | Creates `profiles` + `user_settings` on signup; F-03 depends on it. |
| Usage RPC | `auth.uid()` inside function, no `user_id` arg | Prevents cross-user counter increments via PostgREST. |
| Period boundaries | `period_start` inclusive, `period_end` exclusive (UTC) | Single rule for RPC and UI “resets on” copy. |

## Scope

**In scope:**

- Supabase CLI scaffold + migrations workflow (`supabase/` + `supabase/migrations/`)
- Tables: `profiles`, `user_settings`, `usage_periods`, `practice_sets` (with `title` + `content jsonb`)
- `handle_new_user` trigger (profile + default settings on Auth signup)
- RLS enablement + policies for all tables
- Atomic increment RPCs (`increment_generation_usage`, `increment_check_usage`) using `auth.uid()`

**Out of scope:**

- OAuth/session wiring, middleware, or protected routes (F-03)
- Full JWT-based RLS proof (optional in F-02; required in F-03)
- PRO **daily** cap schema (FR-020) — deferred to S-05 (`usage_daily` or equivalent)
- Any UI or server endpoints that read/write practice sets or usage
- Blog data in DB (blog remains repo-based static content in v1)
- Separate `practice_questions` / `practice_answers` / `practice_checks` tables

## Architecture / Approach

SQL-first schema managed by Supabase CLI migrations. All access is designed around `auth.uid()` so per-user rows are isolated at the database boundary. Usage limits use **rolling monthly periods** from signup. Practice state lives in one JSONB document per set. Future Astro server routes will use user sessions for normal reads/writes and reserve the service role key for admin-only operations.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. CLI + workflow | `supabase/` scaffold + reset-able local DB | Team friction if workflow isn’t documented/consistent |
| 2. Core tables | profiles, settings, usage_periods + RLS | Rolling-period math wrong → limits reset at wrong time |
| 3. Practice sets | `practice_sets` with title + jsonb + soft delete | JSON shape drift without shared TypeScript types later |
| 4. Hardening + RPC | policy completeness + atomic usage increments | Concurrency bugs or policies that block valid future writes |

**Prerequisites:** Supabase project credentials for local dev; Node/npm (already in repo).

**Estimated effort:** ~2–4 sessions across 4 phases (schema + policies + local verification).

## Open Risks & Assumptions

- **PRD alignment:** `prd.md` (2026-05-28) defines rolling **usage periods** for generation/Check quotas; matches `usage_periods` schema. **FR-020** (10 generations per **calendar day** for PRO) stays calendar-day and is implemented in S-05, not F-02.
- We assume storing raw JD/CV is acceptable for MVP if access is server-only and RLS is strict.
- RLS policies must be carefully verified; mistakes can lead to either data leaks or app breakage.
- Large `content` JSONB documents may need size limits in server routes later (~20 questions is fine for MVP).

## Success Criteria (Summary)

- Local Supabase starts and `db reset` applies all migrations cleanly.
- All app tables have RLS enabled with per-user policies.
- Schema supports plan tier, rolling-period usage counters, practice set persistence (`title` + jsonb), and theme preference as prerequisites for upcoming roadmap slices.
