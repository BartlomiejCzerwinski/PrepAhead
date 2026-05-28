# Supabase data schema Implementation Plan

## Overview

Implement **F-02** from `context/foundation/roadmap.md`: add a Supabase-friendly Postgres schema, **RLS everywhere**, and a **Supabase CLI migrations** workflow to persist:

- Users (keyed by Supabase Auth `user.id`)
- Plan tier (FREE/PRO)
- Per-user **usage periods** (rolling monthly windows from signup, not calendar month) for generation + Check counters
- Practice sets (including `title`, sensitive JD/CV, and a single **JSONB** document for questions, answers, and Check feedback)
- Theme preference (per-user, cross-device)

This plan intentionally focuses on **schema + policies + migration workflow**, not the UI or auth wiring (those land in later changes like `supabase-oauth-auth` and `sign-in-and-usage-dashboard`).

## Current State Analysis

- **Supabase data layer is absent**: no `supabase/` directory, no schema SQL, no migrations, no RLS policies, no CLI workflow in repo (scan).
- **Env var names already chosen**: `.env.example` and `src/lib/server/env.ts` include Supabase URL + anon key + service role key names.
- **Server-only boundary is already established**: API routes live in `src/pages/api/*` and must use `export const prerender = false`; secrets must not land in client bundles (`AGENTS.md`).

### Key Discoveries

- `src/lib/server/env.ts` intentionally forbids dynamic env indexing; any Supabase client helpers must use static env access via `requireEnv()` and avoid `import.meta.env[name]`.
- `AGENTS.md` emphasizes JD/CV sensitivity: future server routes must avoid logging raw user content; schema must assume per-user isolation as a hard requirement.
- `context/foundation/roadmap.md` marks F-02 as a foundation slice parallel to F-01 and a prerequisite for OAuth + usage dashboard.

## Desired End State

After this plan is complete:

1. Repo contains a Supabase CLI project directory `supabase/` with committed SQL migrations representing the full schema and RLS policies.
2. All user-owned tables have **RLS enabled** with policies that constrain access to `auth.uid()` (data isolation requirement).
3. A user’s app data is keyed by **Supabase Auth `user.id`** (uuid) across tables (no email-as-key).
4. Plan tier is stored in DB (default FREE) and can be updated later by Stripe webhooks without rewriting schema.
5. Usage counters live in `usage_periods`, keyed by **rolling period** derived from the user’s signup anchor (e.g. join 15 May → period ends 15 Jun), not calendar month.
6. Practice sets are stored in one table with a **`title`** and **`content jsonb`** holding the full question set, progress, answers, and Check feedback, and support:
   - in-progress continuation (FR-009) via fields inside `content`
   - soft-delete for user-initiated deletion (FR-010)
   - sensitive JD (and optional CV) stored server-side with strict RLS, no exposure to other users (NFR data isolation)
7. Theme preference persists per-user (US-04 / FR-023), stored in a dedicated settings table.

### Verification commands (local)

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- `npx supabase --version` — succeeds
- `npx supabase init` — creates `supabase/` (first time only)
- `npx supabase start` — local Supabase stack starts
- `npx supabase db reset` — applies migrations cleanly

> Note: App-level verification (sign-in, writing/reading rows) is intentionally deferred to `supabase-oauth-auth` / `sign-in-and-usage-dashboard`.

## What We're NOT Doing

- Implementing OAuth callbacks, sessions, or route protection (F-03)
- Adding any UI (dashboard, practice flow) that reads/writes these tables
- Installing or using Stripe/OpenAI SDKs
- Building API routes for generation/check usage metering yet
- Adding a test runner or CI workflows
- Storing blog content in the database (blog remains repo-based static content in v1)
- **PRO daily generation cap (FR-020)** — no `usage_daily` table or calendar-day counter in F-02; deferred to `stripe-pro-subscription` / metering slice (S-05). F-02 only provides rolling `usage_periods` for monthly generation + Check totals.
- **Full RLS cross-user proof with real JWTs** — optional in F-02; canonical proof lands in `supabase-oauth-auth` (F-03) when Auth exists.

## Implementation Approach

- Use **Supabase CLI** to manage schema migrations as SQL files committed under `supabase/migrations/`.
- Model user data around Supabase Auth’s user id (uuid) and enforce isolation with **RLS on every app table**.
- Store sensitive JD/CV text, but design for minimal exposure:
  - server-only access patterns later (no client reads of raw text)
  - strict RLS policies
  - schema supports truncation/limits at the application boundary (enforced later in server routes)
- Keep plan tier and usage counters **simple and explicit** to support billing and metering logic later.
- Prefer **fewer tables**: practice flow data in one JSONB column on `practice_sets` instead of separate question/answer/check tables.

## Critical Implementation Details

**Rolling usage periods (not calendar month):** `context/foundation/prd.md` defines a **rolling usage period** per account (anchored at signup). Schema implements this via `usage_periods` keyed off `profiles.created_at` (or optional `usage_period_anchor` later). **Pinned convention (UTC):** `period_start` is inclusive; `period_end` is exclusive and equals the next period’s start at the same clock time as the anchor. Example: anchor `2026-05-15T00:00:00Z` → first period `period_start = 2026-05-15`, `period_end = 2026-06-15` (active while `period_start <= now() < period_end`). Server routes and RPC must use this rule, not `date_trunc('month', now())`.

**PRO daily cap (FR-020) stays calendar-day:** When PRO monthly `generation_count` is 101–300, the **10 generations per calendar day** rule is separate from rolling `usage_periods`. S-05 must implement it via a future `usage_daily` table and/or counts of `practice_sets` rows by `date_trunc('day', created_at)` in UTC — not in F-02.

**Practice `content` JSONB:** One document per set. Server routes own read/write; validate shape in application code (no separate `practice_questions` / `practice_answers` / `practice_checks` tables). Suggested top-level keys: `currentQuestionIndex` (number), `questions` (array). Each question object should carry at least: stable `id`, `kind` (`abcd` | `open_ended`), `prompt`, ABCD `options` + `correctOptionIndex` + `selectedOptionIndex`, open-ended `answerText`, optional `checkFeedback` + `checkedAt`. Exact schema is defined in TypeScript types in a later slice; F-02 only commits the column and documents the intent.

## Phase 1: Supabase CLI + migrations workflow

### Overview

Add the Supabase CLI project scaffold and define the local migration workflow the rest of this plan relies on.

### Changes Required:

#### 1. Add Supabase CLI configuration directory

**File**: `supabase/` (new directory)

**Intent**: Establish Supabase as the schema/migrations authority for Postgres.

**Contract**:

- `supabase/` exists in git.
- Migrations are committed under `supabase/migrations/`.
- Local workflow uses:
  - `npx supabase start`
  - `npx supabase db reset`
  - `npx supabase stop`

#### 2. Document local DB workflow for contributors

**File**: `context/changes/supabase-data-schema/plan.md` (this plan) + optionally `context/deployment/deploy-plan.md` (add a short note if needed)

**Intent**: Make it unambiguous how schema changes are applied locally and later promoted to production.

**Contract**:

- Plan includes the authoritative command set in this phase’s success criteria.
- Note that **Supabase data does not roll back with Vercel deploys** (align with `deploy-plan.md` risk note).

### Success Criteria:

#### Automated Verification:

- `npx supabase --version` succeeds
- `npx supabase init` has been run (repo contains `supabase/`)
- `npx supabase start` succeeds locally
- `npx supabase db reset` succeeds (even if schema is still minimal at this point)
- `npm run build` exits 0
- `npm run astro -- check` exits 0

#### Manual Verification:

- `supabase/` is tracked (not ignored) and visible in git status
- Local Supabase Studio is reachable after `npx supabase start`

---

## Phase 2: Core tables (users, plan, settings, usage)

### Overview

Create the minimum persistent data model to support later slices: plan tier, per-user settings (theme), and rolling-period usage counters.

### Changes Required:

#### 1. Profiles / app user row

**File**: `supabase/migrations/<timestamp>_create_profiles.sql` (name will be CLI-generated)

**Intent**: Store app-specific user fields keyed by Supabase Auth user id.

**Contract**:

- Table `profiles` primary key is `id uuid` that matches `auth.users.id`.
- Includes:
  - `created_at timestamptz` default now()
  - `plan_tier text` (or enum) default `'FREE'`
- RLS enabled + policies: logged-in user can `select` / `update` own row (no client `insert` — row created by trigger).
- **Auth bootstrap (required for F-03):** migration includes `handle_new_user()` (or equivalent) **trigger on `auth.users` insert** that:
  - inserts `profiles` row (`id = new.id`, `plan_tier = 'FREE'`, `created_at = now()`)
  - inserts default `user_settings` row for that `user_id`
  - runs as `security definer` with safe `search_path`
- Document in migration comments that F-03 OAuth assumes this trigger; no manual profile creation in app on first sign-in unless trigger is disabled.

#### 2. User settings (theme preference)

**File**: migration SQL

**Intent**: Persist per-user settings across devices, including theme preference.

**Contract**:

- Table `user_settings` with **`user_id uuid` primary key** (FK → `profiles.id`) — one row per user
- Includes:
  - `theme text` (e.g. `'light' | 'dark' | 'system'`), nullable if you prefer “unset means default”
  - `updated_at timestamptz` default now() (and/or trigger)
- RLS enabled; user can read/write only their row.

#### 3. Rolling-period usage counters

**File**: migration SQL

**Intent**: Support plan-gated usage (FR-012/014/015/019) with atomic increments per **user-specific monthly period** (anchored at signup), not calendar month.

**Contract**:

- `profiles.created_at` is the default **period anchor** (first period starts at signup). Optionally add `usage_period_anchor timestamptz` on `profiles` if anchor must differ from `created_at` later (e.g. PRO subscription start); if omitted, use `created_at` only.
- Table `usage_periods` (replaces earlier `usage_monthly` name) keyed by:
  - `user_id uuid` (FK → `profiles.id`)
  - `period_start timestamptz not null` — start of this rolling month (inclusive)
  - `period_end timestamptz not null` — start of next period (exclusive); e.g. anchor 15 May → `period_start` 15 May 00:00 UTC, `period_end` 15 Jun 00:00 UTC
- Columns:
  - `generation_count int not null default 0`
  - `check_count int not null default 0`
  - `updated_at timestamptz default now()`
- Unique constraint on `(user_id, period_start)`.
- RLS enabled; user can read their own usage period row(s).
- Document in migration SQL how `period_start` / `period_end` are derived from anchor + offset (implementer implements helper SQL or RPC input).

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies migrations successfully

#### Manual Verification:

- In Supabase Studio (local), the tables exist with expected columns and constraints
- RLS is enabled on each table and policies exist (not “RLS enabled but no policies”)

---

## Phase 3: Practice sets (JSONB content) + soft-delete

### Overview

Create a single `practice_sets` table with metadata, sensitive inputs, a human-readable **title**, and one **JSONB** column for the full practice document (questions, answers, Check feedback, progress). No separate question/answer/check tables.

### Changes Required:

#### 1. Practice sets table

**File**: migration SQL

**Intent**: Persist one generated set per generation request: title, JD/CV inputs, status, and all practice state in `content`.

**Contract**:

- Table `practice_sets` includes:
  - `id uuid` primary key
  - `user_id uuid` FK → `profiles.id`
  - `title text not null` — display name for history/dashboard (e.g. derived from role or first line of JD; set at generation time)
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()` — bump when `content` changes
  - `deleted_at timestamptz null` (soft delete)
  - `job_description_text text not null`
  - `cv_text text null`
  - `status text not null` (e.g. `in_progress` | `completed`)
  - `content jsonb not null default '{}'` — full practice payload (see Critical Implementation Details)
- RLS enabled; user can access only their practice sets.
- **Do not** create `practice_questions`, `practice_answers`, or `practice_checks` tables in F-02.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies all migrations successfully

#### Manual Verification:

- Soft delete works via `deleted_at` without dependent FK tables
- `content` accepts a JSON document with a `questions` array (manual insert in Studio as postgres is enough for F-02 schema smoke)
- **RLS cross-user isolation:** full JWT-based negative test is **optional in F-03**; if attempted in F-02, use two local Auth users and a user-scoped client — Studio-only inserts do not prove `auth.uid()` policies

---

## Phase 4: RLS policy hardening + atomic usage helpers (schema-side)

### Overview

Make RLS and policy behavior explicit and safe, and enable atomic increments for usage counters to support future server routes.

### Changes Required:

#### 1. RLS completeness + policy review

**File**: migration SQL (may be folded into earlier migrations or added as a follow-up migration)

**Intent**: Ensure every app table has RLS enabled and policies cover the exact intended access.

**Contract**:

- RLS enabled on: `profiles`, `user_settings`, `usage_periods`, `practice_sets`
- Policies use `auth.uid()` and constrain through `profiles.id` / `practice_sets.user_id`.

#### 2. Atomic increment function(s) for usage

**File**: migration SQL

**Intent**: Provide an atomic, concurrency-safe mechanism for incrementing usage counters.

**Contract**:

- Provide SQL function(s) (RPC), e.g. `increment_generation_usage()` and `increment_check_usage()`, that:
  - use **`auth.uid()`** as the user (no `user_id` argument — prevents cross-user increments via PostgREST)
  - resolve the **current rolling period** from that user’s anchor + `now()` using the pinned UTC convention above
  - upsert `(user_id, period_start)` with correct `period_end` if missing
  - increment the appropriate counter atomically
  - return updated counts and period bounds (`period_start`, `period_end`)
- Security contract:
  - `SECURITY DEFINER` only if needed; set `search_path` explicitly
  - `GRANT EXECUTE` to `authenticated` only; **revoke** from `anon` and `public`
  - do **not** grant execute on these RPCs to service role for normal app metering (service role reserved for documented admin backfills only)

> Server routes call these RPCs with the **user’s JWT** (Supabase client + session), not the service role key, for normal increments.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` succeeds

#### Manual Verification:

- RLS enabled + policies exist on every app table (object inventory in Studio)
- Two concurrent RPC calls as an authenticated user do not lose increments (spot-check)
- Cross-user RLS denial documented as proven in F-03 or via optional F-02 JWT test (see Phase 3 manual note)

---

## Testing Strategy

### Unit Tests

Out of scope (no test runner in repo). Rely on:

- migrations apply cleanly (`supabase db reset`)
- local Studio inspection

### Integration Tests

Deferred to later changes that add auth and server routes, where we can verify end-to-end read/write under user sessions.

### Manual Testing Steps

1. `npx supabase start`
2. `npx supabase db reset`
3. Open local Supabase Studio and verify tables + RLS/policies exist
4. (Optional) Prove RLS with two local Auth users + JWT-scoped `select` (negative cross-user read); otherwise defer to F-03.
5. For this change, schema + migration apply is sufficient without end-to-end app routes.

### RLS verification (F-02 vs F-03)

| Check | F-02 (schema) | F-03+ (Auth) |
|-------|----------------|--------------|
| Tables + policies exist | Studio / `\d+` | Same |
| `auth.uid()` blocks other user’s rows | Optional manual JWT test | Required automated/manual |
| Profile row on signup | Verify trigger inserts row on test Auth user | OAuth E2E |

## Performance Considerations

- JSONB on `practice_sets` keeps the schema small for MVP; one row read/write per session. Index `practice_sets(user_id, created_at)` for history lists; avoid indexing inside `content` until query patterns are known.
- **List/history APIs (S-09):** never `select` `content`, `job_description_text`, or `cv_text` for list views — only `id`, `title`, `status`, `created_at`, `updated_at` (and `deleted_at is null`).
- `usage_periods` supports constant-time reads and atomic increments per rolling window.

## Migration Notes

- Supabase schema changes are **not** automatically rolled back by Vercel deploy rollback (`context/deployment/deploy-plan.md`).
- Prefer forward-only migrations; if a rollback is needed, use a follow-up migration.
- **Product alignment:** PRD (`prd.md` updated 2026-05-28) uses **usage period** for generation/Check quotas; schema `usage_periods` implements that model. **FR-020** (PRO 10/day **calendar day**) remains separate and is out of F-02 scope — track in S-05.

## References

- Roadmap: `context/foundation/roadmap.md` — F-02
- PRD: `context/foundation/prd.md` — data isolation, access control, FR-009/010/012/014/015/019/023
- Stack: `context/foundation/tech-stack.md` — Supabase Auth + Postgres
- Agent rules: `AGENTS.md` — sensitive JD/CV guidance, server-only secrets
- Existing server helpers: `src/lib/server/env.ts`, `src/lib/server/response.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Supabase CLI + migrations workflow

#### Automated

- [ ] 1.1 `npx supabase --version` succeeds
- [ ] 1.2 `npx supabase init` has been run (repo contains `supabase/`)
- [ ] 1.3 `npx supabase start` succeeds locally
- [ ] 1.4 `npx supabase db reset` succeeds (empty/minimal schema ok)
- [ ] 1.5 `npm run build` exits 0
- [ ] 1.6 `npm run astro -- check` exits 0

#### Manual

- [ ] 1.7 `supabase/` directory is tracked in git and Studio is reachable

### Phase 2: Core tables (users, plan, settings, usage)

#### Automated

- [ ] 2.1 `npx supabase db reset` applies core tables migrations cleanly

#### Manual

- [ ] 2.2 Tables exist with expected columns/constraints; RLS enabled + policies present; `handle_new_user` trigger creates profile + settings on test Auth insert

### Phase 3: Practice sets (JSONB content) + soft-delete

#### Automated

- [ ] 3.1 `npx supabase db reset` applies `practice_sets` migration cleanly

#### Manual

- [ ] 3.2 RLS blocks cross-user reads; soft-delete supported; `title` + `content` jsonb present

### Phase 4: RLS hardening + atomic usage helpers

#### Automated

- [ ] 4.1 `npx supabase db reset` applies policy/RPC migrations cleanly

#### Manual

- [ ] 4.2 RLS + policies exist on every app table; usage increment RPC is concurrency-safe

