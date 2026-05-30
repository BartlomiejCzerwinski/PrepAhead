<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Supabase data schema Implementation Plan

- **Plan**: context/changes/supabase-data-schema/plan.md
- **Mode**: Deep
- **Date**: 2026-05-28
- **Verdict**: SOUND
- **Findings**: 0 critical 3 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

`supabase/` absent (expected — plan creates it). `.env.example`, `src/lib/server/env.ts`, `src/pages/api/health.ts`, `context/deployment/deploy-plan.md` ✓. No `@supabase/*` in `package.json` (expected). Brief↔plan aligned.

## Findings

### F1 — Progress 3.2 overstates cross-user RLS proof

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress 3.2 vs Phase 3 manual / Testing Strategy
- **Detail**: Progress 3.2 says “RLS blocks cross-user reads” but Phase 3 manual, What We're NOT Doing, and RLS table defer JWT cross-user proof to F-03 (optional in F-02). Line 250 typo says “optional in F-03” while elsewhere says optional in F-02.
- **Fix**: Reword 3.2 to: policies exist + schema smoke; cross-user denial optional F-02 / required F-03. Fix line 250 to “optional in F-02”.
- **Decision**: PENDING

### F2 — `usage_periods` write path not locked down

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 `usage_periods`; Phase 4 RPC
- **Detail**: Phase 2 specifies user SELECT on `usage_periods` only. Phase 4 RPC upserts rows but plan does not state users must not INSERT/UPDATE/DELETE directly (mutations RPC-only via SECURITY DEFINER).
- **Fix**: Add contract: `usage_periods` policies are SELECT-only for `authenticated`; period rows created/updated only inside increment RPC functions.
- **Decision**: PENDING

### F3 — Month-end period anchor undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Phase 4 RPC
- **Detail**: Pinned convention uses May 15 → Jun 15 example but not anchor day 31 behavior (Jan 31 + 1 month).
- **Fix**: Pin Postgres rule in Critical Details + migration (e.g. `anchor + n * interval '1 month'`) and document Feb/Mar behavior in SQL comments.
- **Decision**: PENDING

### F4 — Remote / production migration apply not documented

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1; Migration Notes
- **Detail**: Plan covers local `supabase start` / `db reset` only. No note on linking remote Supabase project or applying migrations to Preview/Production (expected later, but implementer may wonder).
- **Fix**: One bullet in Migration Notes: “F-02 = local migrations in git; remote `supabase db push` / dashboard apply documented when project is linked (deploy wave 2).”
- **Decision**: PENDING
