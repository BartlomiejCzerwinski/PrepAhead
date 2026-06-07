<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: JD-gated generation

- **Plan**: context/changes/jd-gated-generation/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING ⚠️ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | WARNING ⚠️ |
| Architecture | WARNING ⚠️ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | WARNING ⚠️ |

## Findings

### F1 — Phase 2/4 progress out of sync with verification log

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/jd-gated-generation/plan.md:503-512, verification.md:27-29
- **Detail**: Plan marks Phase 4.4 complete and change `implemented`, but `verification.md` still lists malformed-output no-charge, FREE limit block, and PDF parse failures as not re-verified. Phase 2 rows 2.3, 2.6–2.9 remain unchecked in Progress while core happy path is proven in production.
- **Fix**: Align Progress with `verification.md` — either run the edge-case checks and check off 2.6/2.7/2.8/2.9, or downgrade 4.4 to pending and document accepted MVP gaps in verification only.
- **Decision**: FIXED — unchecked plan 4.4; deferred edge cases documented in verification.md

### F2 — Worker depends on client polling to leave `queued`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: src/pages/api/practice-sets/generate.ts:178-185, src/components/app/GeneratePracticeFlow.tsx:134-156
- **Detail**: Plan step 4 says generate should trigger the worker; implementation returns `202` and relies on the browser to POST `generate-worker` during polling. If the tab closes before the first nudge, the job can remain `queued` until the user returns to `/app/generate`.
- **Fix A ⭐ Recommended**: Fire-and-forget internal worker invoke from `generate.ts` after job creation, keeping client nudge as recovery backup.
  - Strength: Matches plan intent; jobs progress without an open tab.
  - Tradeoff: Two execution paths to reason about (idempotent claim still protects duplicates).
  - Confidence: HIGH — claim/finalize RPCs already idempotent.
  - Blind spot: Vercel double-invoke under retry still needs claim semantics verified.
- **Fix B**: Add a scheduled/server sweeper for stale `queued` jobs.
  - Strength: No change to generate response latency.
  - Tradeoff: Requires new infra/cron not in current stack.
  - Confidence: MED — not in MVP deployment model today.
  - Blind spot: Sweeper frequency vs user expectation.
- **Decision**: FIXED via Fix A — `generate.ts` fire-and-forget worker nudge after job create

### F3 — Generation quota not re-checked at finalize time

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/practice-sets/generate.ts:76-88, supabase/migrations/20260606161500_fix_finalize_generation_job.sql:78-110
- **Detail**: Usage limit is read before job creation; `finalize_generation_job` increments `generation_count` without comparing against tier caps. Parallel requests when one slot remains could all pass the pre-check and finalize, exceeding FREE/PRO limits.
- **Fix**: Enforce cap inside `finalize_generation_job` (read tier + current count under `FOR UPDATE`, raise if at/over limit before increment).
- **Decision**: FIXED — `20260607120000_enforce_generation_cap_on_finalize.sql` adds atomic cap check on upsert

### F4 — No server-side max length on JD / resume text

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/practice-sets/generate.ts:60-129
- **Detail**: PDF path caps at 5 MB, but clients can POST arbitrarily large `jobDescription` or `resumeText` JSON, causing large DB rows and expensive OpenAI calls.
- **Fix**: Reject with `400` when JD or resume text exceeds explicit caps (e.g. 32 KB JD, resume aligned with parse output) before insert/provider call.
- **Decision**: FIXED — JD 32 KB / resume 64 KB caps in `generate.ts`

### F5 — Synchronous worker + 60s platform budget

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Reliability
- **Location**: src/pages/api/practice-sets/generate-worker.ts:9,187-224
- **Detail**: OpenAI generation runs inline in one HTTP request (45 s abort, 60 s Vercel max). Platform kill mid-run can leave jobs `running` until `STALE_RUNNING_MS` (90 s) enables reclaim. Observed 504s in early production testing.
- **Fix A ⭐ Recommended**: Document as known S-02 limitation; tighten stale threshold to ~65 s and ensure recovery UX always surfaces “return to recover.”
  - Strength: No new infra; matches current MVP constraints.
  - Tradeoff: Long generations remain fragile on Vercel.
  - Confidence: HIGH — already partially mitigated.
  - Blind spot: p95 latency under real JD/CV sizes not measured.
- **Fix B**: Move provider call off request thread (true async queue).
  - Strength: Eliminates timeout class.
  - Tradeoff: Out of scope for S-02; new infrastructure.
  - Confidence: MED — plan explicitly deferred external queue.
  - Blind spot: Operational cost of queue provider.
- **Decision**: FIXED via Fix A — `STALE_RUNNING_MS` 65 s; note in verification.md

### F6 — Poll loop may time out before slow jobs finish

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/components/app/GeneratePracticeFlow.tsx:153-184
- **Detail**: Client polls up to 80 attempts (~2 min) then errors, clearing active recovery state even if the DB job may still complete and be recoverable on return.
- **Fix**: On poll exhaustion, show “still running—return to /app/generate to recover” and preserve `activePracticeSetId` instead of a hard failure message.
- **Decision**: FIXED — `GenerationStillRunningError` preserves recovery ids on poll exhaustion

### F7 — Status endpoint keyed by practice set id

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/practice-sets/[id]/status.ts
- **Detail**: Plan implied polling by job id; implementation uses `practice_set_id` in the URL. Works with current UI because generate returns both ids.
- **Fix**: No change required for MVP; document URL contract in plan addendum if desired.
- **Decision**: SKIPPED — acceptable MVP URL contract

### F8 — Finalize fix migration inlines usage increment

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260606161500_fix_finalize_generation_job.sql
- **Detail**: Unplanned fix migration replaces nested `increment_generation_usage()` with inlined upsert + `row_security = off`. Required for production save path; semantics match plan (increment once on success).
- **Fix**: None for MVP — already documented in verification commits table.
- **Decision**: SKIPPED — required production fix; documented in verification

## Automated verification

| Check | Result |
|-------|--------|
| `npm run build` | PASS (exit 0) |
| `npm run astro -- check` | PASS (0 errors, 1 hint on deprecated `returnValue`) |

## Manual verification gaps

| Progress row | Status | Evidence |
|--------------|--------|----------|
| 2.3 local db reset | Unchecked | Skipped — Docker unavailable |
| 2.6 malformed no-charge | Unchecked | `simulateMalformed` exists; not re-verified |
| 2.7 FREE limit block | Unchecked | Gate code exists; not re-verified |
| 2.8–2.9 idempotency | Unchecked | Happy path only |
| Core happy path + recovery | Checked | User + verification.md |
