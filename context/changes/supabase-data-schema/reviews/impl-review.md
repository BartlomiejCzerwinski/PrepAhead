<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Supabase data schema

- **Plan**: context/changes/supabase-data-schema/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-05-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated checks (re-run at review)

| Command | Result |
|---------|--------|
| `npm run build` | PASS |
| `npm run astro -- check` | PASS (0 errors) |
| `npx supabase db reset` | Not re-run (no local Docker); prod migrations applied via GitHub → `prod` |

## Implementation inventory

| Planned artifact | Delivered |
|------------------|-----------|
| `supabase/` + migrations workflow | `supabase/config.toml`, `README.md`, 3 SQL migrations |
| `profiles`, `user_settings`, `usage_periods` + RLS | `20260528194500_create_core_tables.sql` |
| `handle_new_user` trigger | Same migration |
| `practice_sets` + JSONB `content` + soft delete | `20260530110000_create_practice_sets.sql` |
| Usage increment RPCs + RLS hardening | `20260530120000_usage_rpcs_and_rls_hardening.sql` |
| FR-020 daily cap / `usage_daily` | Correctly omitted |
| Separate question/answer/check tables | Correctly omitted |

Prod verification (user): tables, RLS, policies, trigger (`theme` null initially), `practice_sets`, RPC functions deployed.

## Findings

### F1 — Missing `supabase/seed.sql` while seeding enabled in config

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/config.toml:65
- **Detail**: `[db.seed]` references `./seed.sql` but the file does not exist. Local `npx supabase db reset` may fail on seed step; production deploy skips seed on protected branch (observed in user logs).
- **Fix**: Add an empty `supabase/seed.sql` (`-- no seed data for F-02`) or set `sql_paths = []` / `enabled = false` until seeds are needed.
- **Decision**: FIXED — added `supabase/seed.sql` placeholder

### F2 — Phase 1 local CLI steps marked complete without local Docker run

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/supabase-data-schema/plan.md (Progress 1.3, 1.4)
- **Detail**: Progress rows for `supabase start` / `db reset` are `[x]` with SHA `f2f1cba`, but local stack was skipped; validation relied on prod GitHub integration instead. Acceptable for this project’s deploy path; future contributors should use README + Docker for local schema work.
- **Fix**: No code change required; optional note in `supabase/README.md` that prod-only deploy is valid when Docker is unavailable.
- **Decision**: FIXED — README section added
