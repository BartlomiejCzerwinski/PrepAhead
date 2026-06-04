# Public blog and SEO — Plan Brief

> Full plan: `context/changes/public-blog-and-seo/plan.md`
> PRD: `context/foundation/prd.md` (FR-024–FR-032, US-05)
> Shape: `context/foundation/shape-notes.md`

## What & Why

PrepAhead’s core value sits behind sign-in; without indexable interview-prep content, the domain cannot earn organic search traffic. This change adds a **public blog** on prepahead.dev — curated quizzes and question articles with SEO basics and CTAs into JD-tailored practice — while keeping user JD/CV and practice data off blog pages.

## Starting Point

The repo has a marketing landing page (`/`) and minimal `Layout.astro` SEO (title + meta description only). No blog routes, content collections, sitemap, `robots.txt`, or React islands exist. F-01 (static + on-demand API) and F-02 (no blog in DB) are done; **F-03 (`/app` + middleware → `/login`) is done** — blog CTAs target `/app` (middleware redirects to sign-in).

## Desired End State

Anonymous visitors and crawlers can open `/blog`, read **three launch posts** (two interactive quizzes with in-page scoring, one open-ended article), see unique title/description/canonical metadata, discover URLs via a **site-wide sitemap**, and follow a CTA to **`/app`** (unauthenticated users redirect to sign-in when F-03 middleware is live). Founders add future posts by committing markdown to the repo.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Post URLs | Flat `/blog/[slug]` | Simple Astro routing and stable canonicals for a small launch catalog | Plan |
| Interactive quiz | SSR blocks + `quiz-practice-client.ts` | Full Q&A in prerendered HTML; minimal JS for scoring | Impl (2026-06-04) |
| JSON-LD | Fast-follow | Ship FR-029/030 first; add Article/Quiz schema after URLs stabilize | Plan |
| Blog CTA | `/app` (auth gate redirects to login) | Single funnel entry; matches F-03 protected practice prefix | Plan |
| Site discovery | Footer link to `/blog` only | Minimal landing churn while still enabling internal links | Plan |
| Sitemap | Full site (`/`, `/blog`, posts) | `@astrojs/sitemap` with `PUBLIC_SITE_URL` satisfies FR-030 holistically | Plan |
| Frontmatter | Standard fields + `type` enum | Powers index, layout selection, and SEO without CMS | Plan |
| Launch content | Three founder-authored real posts | Meets PRD mix-of-formats launch bar and validates all layouts | Plan |

## Scope

**In scope:** Astro Content Layer (`src/content.config.ts`); `src/content/blog/` markdown; blog index + `[slug]` routes; two post layouts (`open-ended`, `interactive-quiz`); quiz practice client; extended layout SEO (canonical); `@astrojs/sitemap`; `robots.txt`; footer blog link; three launch posts; `npm run build` + `astro check`.

**Out of scope:** JSON-LD (fast-follow); analytics; headless CMS; user-generated posts; blog AI Check; paywalled posts; theme toggle persistence (S-06); Vitest/Playwright; header nav link; MDX unless required for a post body.

## Architecture / Approach

Founder-authored markdown lives in a **blog** content collection with a Zod schema (`type`: `open-ended` | `interactive-quiz`). Build-time `getCollection` / `getEntry` drive prerendered `/blog` and `/blog/[slug]` pages. Open-ended bodies render via `render()`; interactive quizzes render Q&A from frontmatter `quiz` in SSR Astro components plus a small client script for scoring. `Layout.astro` gains `canonicalPath`; `astro.config.mjs` sets `site` from `PUBLIC_SITE_URL` for sitemap and canonicals. CTAs use `/app` — F-03 middleware redirect is live.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Content layer & config | Schema, loaders, `site` URL, sitemap dep | Astro 6 loader/schema mistakes break build |
| 2. SEO & site chrome | Canonical layout, sitemap, robots, footer link | Missing `PUBLIC_SITE_URL` in Vercel breaks canonicals |
| 3. Blog routes | Index + dynamic slug pages | Wrong `entry.id` vs slug in Astro 6 paths |
| 4. Post formats & quiz client | Two layouts + `quiz-practice-client.ts` | Quiz data/schema drift between posts |
| 5. Launch posts & verification | 3 real posts + manual SEO smoke | Launch content quality and SEO smoke on Preview |

**Prerequisites:** Landing layout exists; `PUBLIC_SITE_URL` set in Vercel Preview/Production; F-03 done (blog CTAs to `/app` redirect via middleware).

**Estimated effort:** ~3–4 focused sessions across 5 phases (includes content writing).

## Open Risks & Assumptions

- **F-03 timing:** Done — `/app` CTAs redirect to `/login` via middleware.
- **No test runner:** Quiz scoring verified manually; consider extracting pure `scoreQuiz()` when tests are introduced repo-wide.
- **Theme:** Blog uses OS `prefers-color-scheme` like landing until S-06; must remain readable in both modes.
- **MVP timeline:** Blog v1 plus practice stream may slip (~3 weeks after-hours risk accepted 2026-05-26).

## Success Criteria (Summary)

- Visitor opens `/blog`, reads all three launch posts without sign-in, completes interactive quiz with result summary.
- View-source shows server-rendered article HTML; each post has title, description, canonical; sitemap lists blog URLs.
- CTA on posts routes to `/app`; no user JD/CV on blog pages; `npm run build` and `astro check` pass.
