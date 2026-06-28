# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-28 (Phase 1 change opened)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put an
   LLM judge on top of a deterministic structural check that already catches
   the regression.
2. **User concerns are first-class evidence.** The builder's stated worry —
   silent regression in a mostly-AI-coded codebase they do not know well —
   carries the same weight as PRD lines or hot-spot data. The rollout exists
   to make critical-path breakage fail loudly.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is produced
   by `/10x-research` during each rollout phase. If the plan and research
   disagree about where the failure lives, research is the ground truth.

Hot-spot scope used for likelihood weighting: `src/` (34 commits/30d).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Plan/usage gate bypass or miscount — FREE 1-generation / 5-Check or PRO fair-use (soft 100, daily 10, hard 300) / 500-Check limits leak, or usage increments on failure / double-counts | High | High | PRD FR-014/015/016/018/019/020/021, NFR "Billing integrity"; interview Q1 (silent regression in AI-coded app), Q3 (`src/pages/api` least confident); hot-spot dir `src/lib/plan` (7 commits/30d), `src/pages/api` (22 commits/30d) |
| 2 | Authorization / IDOR — a practice-set endpoint serves or mutates a set the signed-in user does not own, exposing another user's JD/CV/answers | High | Medium | PRD Access Control ("tied to signed-in identity"), NFR "Data isolation", Privacy guardrail; hot-spot dir `src/pages/api` (22 commits/30d); abuse lens (authorization/IDOR) |
| 3 | Generation contract violated — a silent partial or wrong-count set (≠15 ABCD + 5 open-ended) is shown instead of a clear failure | High | Medium | PRD FR-004, US-01 AC ("~20 unless generation fails — user sees a clear error, not a silent partial set"); hot-spot dir `src/lib/practice` (10 commits/30d), `src/pages/api` (22 commits/30d) |
| 4 | Auth/session protection regression — unauthenticated access to `/app/*`, or a redirect loop / spurious logout after a change in the auth area | High | Medium | PRD FR-001, Access Control; hot-spot dir `src/pages/api` (22 commits/30d), file churn on session middleware and auth callback (interview Q3); abuse lens (access) |
| 5 | Secret / PII leakage — raw JD/CV text or a provider API key lands in server logs, an error response body, or the client bundle | High | Medium | AGENTS.md hard rules ("avoid logging raw user content", "no provider API keys in client bundles"), Privacy guardrail, NFR "Data isolation"; abuse lens (secret/PII leakage) |
| 6 | Honest-AI grounding drift — generation fabricates candidate facts when CV is omitted, or Check returns generic praise instead of JD-grounded critical feedback | High | Medium | PRD Guardrails "Honest AI" / "JD-grounded", NFR "Check feedback quality", FR-004/FR-017; hot-spot dir `src/lib/server` (8 commits/30d) |

**Impact × Likelihood rubric.** High = user loses access, data, or money / publicly visible; area changes weekly or we have been burned here. Medium = feature degrades or a workaround exists; touched occasionally. Low = cosmetic; stable code.

Risk #1 is the only High × High: it sits on the money/trust path, in the highest-churn area (`src/pages/api`), and is exactly where the builder feels least confident. Risks #2–#6 are High-impact × Medium-likelihood. No High-impact × Low-likelihood scenario is padded into the map; provider outages belong to observability, not a test.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | At FREE limit a generation/Check is blocked with remaining = 0; usage rises only on success; PRO hard-stops at 300 and daily-caps at 10 when above the soft limit | "A happy-path generation worked, so metering is fine" | Where limits are evaluated; increment-on-success vs on-call; rolling usage-period vs calendar-day boundary | unit + integration on plan/usage logic | Oracle problem — assert against PRD limits (FREE 1/5, PRO 100/10/300, 500), never against numbers read from the increment code |
| #2 | A request for another user's set `[id]` is denied (404/403), not served their JD/CV/answers; mutations on a non-owned set are rejected | "Logged-in == authorized for this resource" | Whether endpoints check ownership in code or lean on RLS; what RLS actually enforces for each table | integration on the `[id]` API handlers | Happy-path-only (testing solely the caller's own set) |
| #3 | A malformed/short model response yields a clear failure with no charge and no partial set; a valid run is exactly 15 ABCD + 5 open-ended | "The model returned something == it is a valid set" | The parse/validate/finalize boundary and the no-charge-on-failure path | unit on the contract parser + integration on finalize | Asserting the set against the generator's own output instead of the PRD spec |
| #4 | Unauthenticated `/app/*` redirects to `/login`; an authenticated user reaches the app with no redirect loop | "The callback works == every route is protected" | Middleware matcher scope, redirect targets, the session-refresh path | integration on middleware / redirect logic | Mirroring the middleware implementation inside the assertion |
| #5 | Logged output and error bodies for a generate/Check call contain no raw JD/CV; no provider key appears in the client bundle | "No error was thrown == nothing leaked" | Where logging happens, what error bodies return, what ships client-side | unit/integration leak-guard on log + error surfaces; build-bundle scan | Only exercising the happy path; never hitting the error/log branch |
| #6 | With CV omitted, output references no employer/skill absent from the JD; Check feedback is specific to the submitted text, not generic praise | "Output looks plausible == it is grounded and honest" | Prompt construction, what JD/CV is actually passed, a fixture JD with known facts | AI-native (LLM judge / assertion) on a fixed JD fixture — last, only if cheaper structural checks miss it | Building a heavy AI judge over signal that #3's structural checks already catch |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|----------------|------------|--------|----------------|
| 1 | Test runner + critical gating coverage | Bootstrap Vitest; prove plan/usage limits are enforced and metered, and endpoints reject non-owners | #1, #2 | unit + integration | change opened | context/changes/testing-runner-and-critical-gating/ |
| 2 | Generation & practice contract integrity | Prove an exact 15 + 5 set or a clean failure, and that answer/Check increments are correct | #3 | unit + integration | not started | — |
| 3 | Auth protection + leakage guards | Prove `/app/*` stays gated without loops and no raw JD/CV or keys leak to logs/errors/bundle | #4, #5 | integration + build-bundle scan | not started | — |
| 4 | AI-native honest-grounding layer | Prove no fabricated CV facts and JD-specific Check feedback | #6 | AI-native (LLM judge on fixture) | not started | — |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools carry a `checked:`
date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | ^4.1 | none yet — see §3 Phase 1. Astro 6 ships Vite 7; the documented `getViteConfig()` + Vitest 4 path crashes (`exports is not defined`, CJS `cookie`) below 4.1.0-beta.6 — pin `vitest@^4.1`, or use plain `defineConfig` for pure server-logic tests to sidestep it. Confirm at bootstrap. |
| API / Supabase mocking | TBD (e.g. MSW or a thin Supabase client stub) | — | none yet — see §3 Phase 1. Mock at the network/DB-client edge only. |
| e2e | not planned for v1 | — | Excluded under cost × signal for a solo after-hours MVP; revisit only if a failure mode requires the full deployed shape. |
| AI-native | LLM judge on a fixed JD fixture — checked: 2026-06-28 | n/a | none yet — see §3 Phase 4. Use only for the non-deterministic honest-grounding signal (#6); never where #3's structural checks suffice. |

**Stack grounding tools (current session):**
- Docs: Context7 / framework docs MCP — none available; relied on local manifests + WebSearch; checked: 2026-06-28
- Search: WebSearch (web search tool) — used to verify Astro 6 + Vitest setup currency and the `getViteConfig()`/Vitest 4 regression; checked: 2026-06-28
- Runtime/browser: Playwright MCP / browser tool — none available; not used; checked: 2026-06-28
- Provider/platform: Supabase / Vercel / GitHub MCP — none available; RLS and deploy gates to be confirmed via `/10x-research`; checked: 2026-06-28

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck (`npm run astro -- check`, `npm run build`) | local | required | syntactic / type drift, broken build |
| unit + integration | local | required after §3 Phase 1 | plan/usage, authorization, and contract logic regressions |
| build-bundle leak scan | local | required after §3 Phase 3 | raw JD/CV or provider keys shipped client-side |
| AI-native honest-grounding check | local | optional after §3 Phase 4 | fabrication / generic-feedback drift |
| pre-prod smoke (Vercel Preview) | between merge + prod | optional | environment-specific failures (per `context/deployment/deploy-plan.md`) |

No CI gate is listed: the repo has no `.github/workflows/` and the roadmap parks CI/CD for the solo MVP. Gates run locally + on Vercel Preview until a CI rollout phase is added.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that, it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test

- TBD — see §3 Phase 1 (plan/usage limit logic; assert against PRD limits, not against the increment code).

### 6.2 Adding an integration test

- TBD — see §3 Phase 1 (API handler request → response + side-effect; mock at the Supabase/network edge only, never internal modules).

### 6.3 Adding a test for a new API endpoint

- TBD — see §3 Phase 1 (the highest-priority pattern: ownership/authorization assertion plus usage-metering side-effect for any `src/pages/api` route).

### 6.4 Adding a generation/contract test

- TBD — see §3 Phase 2 (exact 15 ABCD + 5 open-ended, and the no-charge-on-failure path).

### 6.5 Adding an auth / leakage-guard test

- TBD — see §3 Phase 3 (middleware redirect behavior; log + error bodies exclude raw JD/CV; bundle scan for keys).

### 6.6 Adding an AI-native honest-grounding test

- TBD — see §3 Phase 4 (LLM judge on a fixed JD fixture: no fabricated CV facts, JD-specific Check feedback).

### 6.7 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note here capturing anything surprising the phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Marketing, blog, and landing pages** (`src/components/landing`, `src/components/blog`, `src/pages/blog`, `src/content/blog`) — founder-authored static/editorial content with low blast radius; the builder wants budget spent exclusively on in-app (signed-in) features and the API layer. Re-evaluate if the blog gains user-generated content, metered AI, or auth-linked behavior. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-28
- Stack versions last verified: 2026-06-28
- AI-native tool references last verified: 2026-06-28

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive (e.g. S-05 Stripe billing unblocks and ships),
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
