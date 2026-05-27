<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Server API foundation

- **Plan**: `context/changes/server-api-foundation/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-26
- **Verdict**: SOUND (after triage fixes)
- **Findings**: 1 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

`Grounding: 6/6 paths ✓, symbols ✓ (astro.config adapter, no api/), brief↔plan ✓ (both agree on hybrid — but that agreement is wrong for Astro 6)`

Runtime check: `validateConfig({ output: 'hybrid' })` on Astro 6.3.7 → **rejected** with message that `hybrid` has been removed.

## Findings

### F1 — `output: 'hybrid'` fails on Astro 6.3.7

- **Severity**: CRITICAL
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Desired End State §1, Phase 1, Implementation Approach, plan-brief, change.md
- **Detail**: The plan’s central config change is `output: 'hybrid'`. Astro 6.3.7 (`package.json`) validates config with a refine that **rejects** `hybrid` (`node_modules/astro/dist/core/config/schemas/base.js`). Runtime `validateConfig({ output: 'hybrid' })` fails with: *"The `output: \"hybrid\"` option has been removed. Use `output: \"static\"` (the default) instead…"*. Since Astro 5, **`static` + `export const prerender = false`** on API routes is the replacement for hybrid. Implementing the plan as written blocks Phase 1 at `npm run build`.
- **Fix A**: Remove `output: 'hybrid'` from config; keep default `static`; add `vercel({ maxDuration: 60 })`; rely on `prerender = false` in `src/pages/api/health.ts`. Update plan/brief/deploy-plan wording from “hybrid” to “static with on-demand API routes.”
  - Strength: Matches Astro 6 docs and installed schema; same end state the plan intends (static pages + serverless `/api/*`).
  - Tradeoff: Doc churn across plan, brief, `change.md`, and Phase 3 deploy-plan edits.
  - Confidence: HIGH — verified against Astro 6.3.7 config schema and validateConfig.
  - Blind spot: None significant.
- **Fix B**: Set `output: 'server'` (all routes SSR by default); mark marketing pages `prerender = true`.
  - Strength: Explicit server mode; familiar to SSR-first teams.
  - Tradeoff: Every page must opt into static; higher risk of missing `prerender = true` on landing/blog and slower/costlier deploy surface.
  - Confidence: HIGH for feasibility; MED for fit with speed/lean goal.
  - Blind spot: Blog slice (S-08) not yet in repo — more pages to annotate.
- **Decision**: FIXED (Fix A — static + on-demand APIs; plan/brief/change updated)

### F2 — Phase 1.3 checks API bundling before API routes exist

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Automated Verification + Progress 1.3
- **Detail**: Success criterion 1.3 requires build output to show “server/API bundling,” but `src/pages/api/health.ts` is Phase 2. After Phase 1 alone, a correct build may show **no** API routes — implementer may think Phase 1 failed or add premature stubs.
- **Fix**: Move criterion 1.3 to Phase 2 (e.g. 2.3, renumber), or replace with “build succeeds with adapter + maxDuration; landing still static-only.”
- **Decision**: FIXED (criterion moved to Phase 2.3; Progress renumbered)

### F3 — `requireEnv` via dynamic `import.meta.env[name]` may break on Vercel

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — `src/lib/server/env.ts` contract
- **Detail**: Contract allows `requireEnv(name: string)` reading `import.meta.env[name]`. Vite/Astro inlines **static** `import.meta.env.FOO` references at build time; dynamic indexing often yields `undefined` in production even when the var is set in Vercel. Health route skips this, but F-03/S-02/S-05 will copy the helper — silent production failures.
- **Fix A**: Document that `requireEnv` must use a **static** key per call site (e.g. `requireEnv('OPENROUTER_API_KEY')` implemented via switch or explicit property access), or typed wrapper functions per var.
  - Strength: Works with Vite’s env model; no runtime surprise.
  - Tradeoff: More boilerplate than a generic helper.
  - Confidence: HIGH — standard Vite behavior.
  - Blind spot: Astro server runtime env injection on Vercel not re-tested in this review.
- **Fix B**: Use `process.env[name]` in server-only modules with `vite.ssr.noExternal` / Astro server env docs — only if verified for `@astrojs/vercel`.
  - Strength: True dynamic lookup.
  - Tradeoff: Differs from plan’s `import.meta.env` convention; needs doc alignment.
  - Confidence: MED.
  - Blind spot: Adapter-specific env bridging not verified in code.
- **Decision**: FIXED (Fix A — static EnvKey union + static import.meta.env access)

### F4 — Phase 3 deploy-plan contract still says “hybrid”

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — deploy-plan.md Contract
- **Detail**: Phase 3 instructs updating deploy-plan to describe “**hybrid**” output. If F1 is fixed to static + on-demand APIs, this doc edit would **encode the wrong model** and confuse F-02/F-03 implementers.
- **Fix**: Tie deploy-plan wording to F1 fix: “static (default) + on-demand `/api/*` via `prerender = false`” and reference Astro 6 on-demand rendering guide.
- **Decision**: FIXED (via F1 — deploy-plan contract updated in plan)

### F5 — `change.md` uses `status: implemented`

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Implementation Note
- **Detail**: Plan says set `change.md` to `implemented` after Preview smoke. Repo lifecycle elsewhere uses `planned` → implementing flow; confirm this status string matches `/10x-implement` / archive conventions to avoid tooling drift.
- **Fix**: Use the status value your change workflow defines (e.g. `implemented` vs `complete`) and align with `context/changes/README.md` if it lists allowed values.
- **Decision**: ACCEPTED (keep `implemented` after Preview smoke)

### F6 — Optional `src/env.d.ts` left open-ended

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — TypeScript env typings
- **Detail**: “Create only if missing” is fine; `tsconfig.json` already includes `.astro/types.d.ts`. Implementer may duplicate typings. Low risk — `astro check` will catch gaps.
- **Fix**: Phase 1 intent: run `astro check` after Phase 2; add `src/env.d.ts` only if check fails on `import.meta.env` keys.
- **Decision**: ACCEPTED (add env.d.ts only if astro check fails)
