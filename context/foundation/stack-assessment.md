---
project: PrepAhead.dev
assessed_at: 2026-05-26T00:00:00Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript
  framework: Astro 6 (React 19 islands)
  build_tool: Astro / Vite
  test_runner: null
  package_manager: npm
  ci_provider: null
  deployment_target: Vercel (@astrojs/vercel)
gates_passed: 10
gates_failed: 3
---

## Stack Components

**Language — TypeScript 6.x**  
`tsconfig.json` extends `astro/tsconfigs/strict`. `typescript` and `@astrojs/check` are in `package.json`. JSX is configured for React (`react-jsx`). Node engine `>=22.12.0`.

**Framework — Astro 6.3 + React 19 islands**  
`astro.config.mjs` enables `@astrojs/react`, Tailwind via `@tailwindcss/vite`, and `@astrojs/vercel` adapter. Routes live under `src/pages/` (currently `index.astro` + landing components). Marketing UI is `.astro`; interactive UI is intended as React islands per `AGENTS.md`.

**Styling — Tailwind CSS v4**  
Integrated through Vite plugin in `astro.config.mjs`; global tokens in `src/styles/global.css`.

**Build tool — Astro CLI / Vite**  
Scripts: `npm run dev`, `build`, `preview`, `astro`. No separate Vite config file; Astro owns the build.

**Test runner — not detected**  
No Vitest, Jest, Playwright, or Cypress config or devDependency in `package.json`. `AGENTS.md` explicitly states no test runner exists.

**Package manager — npm**  
`package-lock.json` present.

**CI/CD — not detected**  
No `.github/workflows/` or other CI config in the repository.

**Deployment — Vercel**  
`adapter: vercel()` in `astro.config.mjs`. Deploy workflow documented in `context/deployment/deploy-plan.md` and `AGENTS.md` (production branch `prod`, URL `https://prepahead.dev`).

**Instruction files — `AGENTS.md`**  
Covers hard rules, structure, `astro check`, deployment, and PR conventions. No blog-specific conventions yet.

**Change scope (from `context/foundation/prd-v2.md`)**  
Blog module: public index + markdown/static posts + interactive quiz (React island) + SEO metadata + sitemap + CTA to existing practice flow. Core practice, auth, and billing stacks are out of scope for replacement; blog adds **content routes**, **content collections (recommended)**, and **one interactive island pattern**.

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict   |
|-------------|-------|------------|---------------|------------|-----------|
| Language    | ✓     | —          | —             | —          | pass      |
| Framework   | —     | ✓          | ✓             | ✓          | pass      |
| Build tool  | —     | ✓          | ✓             | ✓          | pass      |
| Test runner | —     | ✗          | ✗             | ✗          | fail      |

Legend: ✓ = pass, ✗ = fail, — = not applicable

### Gate Details

**Language — Typed: pass**  
Evidence: `tsconfig.json` line 2 — `"extends": "astro/tsconfigs/strict"`. TypeScript in `devDependencies`; React types included.

**Framework (Astro) — Convention-based: pass**  
Evidence: File-based routing under `src/pages/`; islands architecture documented in Astro and mirrored in `AGENTS.md` (`src/pages/`, `src/components/`, `src/layouts/`). Landing follows `src/components/landing/*` + `LandingPage.astro` composition pattern.

**Framework (Astro) — Popular in training data: pass**  
Evidence: Astro is a mainstream choice in the JS/TS ecosystem for content-heavy sites and fits the blog + marketing + islands model. React 19 for interactive quiz aligns with high training-data coverage within the same family.

**Framework (Astro) — Well-documented: pass**  
Evidence: Official Astro docs are versioned; project uses Astro 6.x with current integration docs for React, Tailwind, Vercel, and Content Collections.

**Build tool (Astro/Vite) — Convention-based: pass**  
Evidence: Single `astro.config.mjs` entry point; `npm run build` is the canonical production build. Vite plugins registered inside Astro config.

**Build tool — Popular in training data: pass**  
Evidence: Vite + Astro build patterns are widely represented in training data for modern front-end stacks.

**Build tool — Well-documented: pass**  
Evidence: Build and deploy paths documented via Astro + `@astrojs/vercel` official guides.

**Test runner — Convention-based: fail**  
Evidence: No test directory, no test script in `package.json`, no test config files. `AGENTS.md` line 31: "No test runner … exists yet."

**Test runner — Popular in training data: fail (no component)**  
Evidence: Agents cannot mirror an existing test layout or runner choice in this repo. When tests are added, pick a conventional default (Vitest for unit/component tests in Vite projects) and document it.

**Test runner — Well-documented: fail (no component)**  
Evidence: No project-local test docs or examples to cite.

## Gaps & Compensation

### 1. No automated test runner (convention + training + docs)

**Why it matters:** Blog work adds routes, content schema, and a React quiz island. Without tests, agents and humans rely on manual `build` + `astro check` only; regressions in interactive quiz logic are easy to miss.

**Compensation:** Document test conventions when introduced; until then, enforce `npm run build` and `npm run astro -- check` in PR checklist. Add Vitest (or Playwright for E2E) in a dedicated change and update `AGENTS.md` with one canonical runner.

### 2. No CI workflow in repo

**Why it matters:** Agents may assume GitHub Actions gates exist; `AGENTS.md` correctly forbids claiming CI that is not present.

**Compensation:** Keep the explicit "no CI" rule; optional fast-follow: minimal workflow running `npm run astro -- check` and `npm run build` on PRs to `prod`.

### 3. Blog module conventions not yet in instruction files

**Why it matters:** PRD v2 adds content types (static quiz, open-ended, interactive quiz) and SEO requirements. Astro Content Collections are the convention-aligned path but are not scaffolded yet; without rules, agents may invent inconsistent `src/pages/blog/*.astro` layouts.

**Compensation:** Add blog-specific rules to `AGENTS.md` (see paste blocks below). Reference `context/foundation/prd-v2.md` for blog FRs alongside `prd.md` for core MVP.

### 4. Dual PRD sources

**Why it matters:** Core MVP is in `prd.md` (greenfield); blog delta is in `prd-v2.md` (brownfield). Agents following only `prd.md` will miss blog scope.

**Compensation:** Point blog work at `prd-v2.md`; keep `prd.md` for practice/auth/billing.

## Recommended Instruction File Additions

Paste into `AGENTS.md` (adjust paths once content collections are scaffolded):

```markdown
## Blog module (prd-v2)

- Product scope for the blog: `@context/foundation/prd-v2.md` (brownfield). Core MVP remains `@context/foundation/prd.md`.
- **Routes:** `src/pages/blog/index.astro` (index), `src/pages/blog/[...slug].astro` or per-slug pages under `src/pages/blog/` — follow one pattern consistently.
- **Content:** Prefer Astro **Content Collections** for posts (`src/content/blog/`, schema in `src/content.config.ts`). Founder-authored markdown only in v1; no CMS.
- **Post types:** static quiz (Q+A in markdown), open-ended (prompts only), interactive quiz (use a **React island** for in-page scoring; keep article body server-rendered for SEO).
- **SEO:** Every post needs `title`, `description`, and stable URL; add sitemap integration when implementing FR-007. Article HTML must be in the initial response (not client-only).
- **Privacy:** Blog pages never show user JD/CV, practice history, or auth-only data.
- **Theme:** Blog uses the same layout and light/dark behavior as landing (`src/layouts/Layout.astro`).
- **CTA:** Link to existing sign-in / practice entry; do not duplicate billing or generation logic on blog pages.
```

Optional when adding tests:

```markdown
## Tests

- **Runner:** Vitest (unit/component) — config at repo root once added.
- **Convention:** Colocate `*.test.ts` / `*.test.tsx` next to the module or under `src/**/__tests__/`.
- **Blog:** At minimum, test interactive quiz scoring logic in isolation (pure functions), not full E2E, unless Playwright is added.
```

## Summary

**Overall agent-readiness: ready-with-compensation**

PrepAhead’s stack is **strong for agent work** on the blog change: TypeScript strict mode, Astro file-based routes, React islands for the interactive quiz, and Vercel deployment are all well represented in training data and official docs. `AGENTS.md` already captures deployment, security, and `astro check` discipline.

**Key strengths:** Typed TS strict; Astro conventions for pages/layouts/components; clear separation of static `.astro` vs React islands; existing landing patterns to extend for blog chrome and theme.

**Key gaps:** No test runner, no in-repo CI, and no blog-specific conventions yet. Compensation is lightweight: extend `AGENTS.md` for blog/content/SEO rules and plan Vitest when quiz logic grows.

**Recommended next step:** Run `/10x-health-check` for dependency audit, security scan, and explicit verification that `build` / `astro check` pass — then implement blog using Content Collections + one quiz island per `prd-v2.md`.
