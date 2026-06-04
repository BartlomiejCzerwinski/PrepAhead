<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Public blog and SEO

- **Plan**: context/changes/public-blog-and-seo/plan.md
- **Scope**: Phases 1–5 (all phases with automated progress complete)
- **Date**: 2026-06-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — `static-quiz` post type removed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: src/content.config.ts:31-37
- **Detail**: Plan and PRD FR-026 require three formats (`static-quiz`, `open-ended`, `interactive-quiz`). Schema now only has `open-ended` and `interactive-quiz`. `StaticQuizPost.astro` deleted; both Java posts use `interactive-quiz` frontmatter. Launch set still has three posts but not three distinct types per plan/PRD.
- **Fix A ⭐ Recommended**: Addendum to plan + PRD notes documenting consolidation — interactive posts SSR all Q&A in HTML (`<details>` reveal works without JS for reading; scoring needs JS).
  - Strength: Preserves shipped UX; answers are in prerendered HTML.
  - Tradeoff: US-05 wording still says "one each of" three formats until PRD updated.
  - Confidence: HIGH — functional coverage for FR-026 content exists in interactive layout.
  - Blind spot: Stakeholder expectation of a non-interactive quiz article label on index.
- **Fix B**: Reintroduce `static-quiz` in schema, restore `StaticQuizPost.astro`, convert one Java post to markdown-body Q&A only.
  - Strength: Strict plan/PRD alignment and index type filter shows three types.
  - Tradeoff: Duplicate rendering paths; more content authoring formats.
  - Confidence: HIGH for schema; MEDIUM for which post to convert.
  - Blind spot: Whether markdown-only static post is still desired long-term.
- **Decision**: FIXED — User chose consolidate to `open-ended` + `interactive-quiz` only; updated plan.md, plan-brief.md, change.md, verification.md (2026-06-04).

### F2 — React island replaced with vanilla client script

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/components/blog/InteractiveQuizPost.astro (no `client:*` island)
- **Detail**: Plan Phase 4 specified `InteractiveQuiz.tsx` as first React island (`client:visible`). Implementation uses `quiz-practice-client.ts` + inline `<script>`. `InteractiveQuiz.tsx` deleted. Scoring still works; no API calls; lighter bundle.
- **Fix A ⭐ Recommended**: Document in plan addendum — vanilla script chosen for SEO (full Q&A in HTML) and zero React hydration on blog.
  - Strength: Matches stack-assessment "minimal client JS"; AGENTS.md still allows React elsewhere.
  - Tradeoff: No React island precedent on blog for future components.
  - Confidence: HIGH — build passes; quiz UX verified in code review.
  - Blind spot: Future interactive features may reintroduce islands anyway.
- **Fix B**: Restore `InteractiveQuiz.tsx` island wired to same `score-quiz.ts`.
  - Strength: Matches original plan and `@astrojs/react` justification.
  - Tradeoff: Duplicates SSR markup; hydration cost; quiz Q&A may be less visible in initial HTML depending on island split.
  - Confidence: MEDIUM — prior plan-review flagged island vs SEO tension.
  - Blind spot: Exact island props vs current Astro components.
- **Decision**: FIXED — Plan Phase 4/docs updated to vanilla `quiz-practice-client.ts` (2026-06-04).

### F3 — Manual verification not recorded in plan Progress

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/public-blog-and-seo/plan.md:462-505
- **Detail**: Phases 2–5 manual checkboxes remain `- [ ]` while `change.md` status is `implemented` and automated items are `[x]`. `verification.md` smoke checklist also unchecked. No evidence of Preview curl/sitemap checks in repo. Automated `npm run build` and `astro check` pass today (2026-06-04).
- **Fix**: Run Preview smoke from `verification.md`, check boxes in plan Progress and verification.md, or downgrade `change.md` to `implementing` until manual items done.
- **Decision**: FIXED — Local/static smoke + plan Progress updated 2026-06-04; Preview items 5.4, 5.6, 5.8 and 4.4 remain open.

### F4 — `verification.md` references obsolete static-quiz wording

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/public-blog-and-seo/verification.md:19
- **Detail**: Checklist says "Static and open-ended posts" but codebase has no `static-quiz` type.
- **Fix**: Update line 19 to "Open-ended and interactive-quiz posts: article body in initial HTML with JS disabled (quiz scoring requires JS)."
- **Decision**: FIXED — Updated verification.md wording (2026-06-04, with F1 plan updates).

### F5 — Unused `src/lib/site-url.ts`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/site-url.ts
- **Detail**: `getSiteOrigin()` duplicates `resolveSiteUrl()` in `astro.config.mjs` and is not imported anywhere in `src/`.
- **Fix**: Delete `site-url.ts` or wire Layout/runtime to use it and share logic with config.
- **Decision**: FIXED — Deleted `src/lib/site-url.ts` (2026-06-04).

### F6 — Content glob allows `.mdx` without MDX integration

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/content.config.ts:30
- **Detail**: Pattern `**/*.{md,mdx}` but no `@astrojs/mdx` in integrations. Plan preferred `.md` only unless needed.
- **Fix**: Change pattern to `**/*.md` until MDX is added.
- **Decision**: FIXED — Glob restricted to `**/*.md` (2026-06-04).
