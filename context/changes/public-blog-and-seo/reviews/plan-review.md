<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Public blog and SEO

- **Plan**: context/changes/public-blog-and-seo/plan.md
- **Mode**: Deep
- **Date**: 2026-05-30
- **Verdict**: SOUND
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓ (minor prop-name drift)

## Findings

### F1 — Stale Current State for F-03 auth and landing CTA

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis; Migration Notes; plan-brief Prerequisites
- **Detail**: Plan documents "Auth / `/app` | Planned (F-03) — not in `src/` yet" and "Cta.astro — Sign in coming soon". Codebase now has `src/middleware.ts` gating `/app` → `/login`, `src/pages/app/index.astro`, Supabase auth routes, and `Cta.astro` linking to `/login`. F-03 coordination is no longer a deploy blocker.
- **Fix**: Update Current State table, soften Migration Notes / plan-brief F-03 prerequisite to "done"; note landing CTA uses `/login` while blog CTAs target `/app` (both valid with middleware).
- **Decision**: FIXED — Updated Current State, Migration Notes, and plan-brief for F-03 done; aligned brief to `canonicalPath`.

### F2 — Preview sitemap verification vs hardcoded robots.txt

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — robots.txt; Phase 5 / Verification commands
- **Detail**: `robots.txt` contract hardcodes `Sitemap: https://prepahead.dev/sitemap-index.xml`. Vercel Preview may set `PUBLIC_SITE_URL` to the preview origin (per deploy-plan), so `@astrojs/sitemap` emits preview URLs — but robots on Preview still points at production sitemap. Manual verification "fetch sitemap via robots" on Preview will mislead.
- **Fix**: In Phase 5 verification, fetch sitemap directly from preview origin (`curl https://<preview>/sitemap-index.xml`), not via robots `Sitemap` line. Document that production robots.txt intentionally references production sitemap only.
- **Decision**: FIXED — Added Preview sitemap verification note to robots contract, verification commands, Phase 5 criteria, and Testing Strategy.

### F3 — Interactive quiz questions not server-rendered

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State #3; Phase 4 — InteractiveQuizPost
- **Detail**: Desired End State says "Interactive post renders question body in HTML" but Phase 4 mounts questions only via `<InteractiveQuiz client:visible quiz={...} />` from frontmatter — no SSR of question text. Intro markdown renders server-side; quiz Q&A does not. Crawlers and view-source checks see intro only. PRD FR-028 requires in-page interaction, not SSR of questions — acceptable for MVP if verification is scoped.
- **Fix A ⭐ Recommended**: Clarify Desired End State #3 and verification: intro/body in HTML; quiz questions hydrate via island. Scope view-source check to static/open-ended posts; interactive verified manually with JS.
  - Strength: Matches Phase 4 implementation; satisfies FR-028 without duplicate content.
  - Tradeoff: Quiz Q&A not indexable as article body in v1.
  - Confidence: HIGH — aligns with PRD and island architecture.
  - Blind spot: None significant.
- **Fix B**: SSR a read-only question list in Astro, hydrate React for scoring.
  - Strength: Full question text in initial HTML for crawlers.
  - Tradeoff: Duplicate rendering paths; more layout complexity.
  - Confidence: MED — not required by PRD for v1.
  - Blind spot: Hydration mismatch if SSR and island diverge.
- **Decision**: FIXED via Fix A — Clarified Desired End State #3, verification commands, and Testing Strategy for interactive SSR scope.

### F4 — Brief/plan prop name drift

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan-brief Architecture vs Phase 2 Layout contract
- **Detail**: plan-brief says `canonicalUrl`; plan uses `canonicalPath` (pathname only). Same intent, different name.
- **Fix**: Align plan-brief to `canonicalPath` when editing F-1 stale-state pass.
- **Decision**: FIXED — Resolved in F1 pass (plan-brief now uses `canonicalPath`).
