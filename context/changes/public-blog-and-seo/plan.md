# Public blog and SEO Implementation Plan

## Overview

Implement roadmap **S-08** (`public-blog-and-seo`): a public, prerendered blog on prepahead.dev with a post index, three launch content formats (static quiz, open-ended, interactive quiz), per-post and site SEO (metadata, canonical URLs, sitemap), footer discovery link, and CTAs to **`/app`** for JD-tailored practice. Content is founder-authored markdown in the repo (FR-032); no database or CMS. Satisfies PRD **FR-024–FR-032** and **US-05**.

## Current State Analysis

| Area | State | Evidence |
| --- | --- | --- |
| Blog routes | Absent | No `src/pages/blog/` |
| Content collections | Absent | No `src/content.config.ts` or `src/content/blog/` |
| SEO | Minimal | `Layout.astro` — title + `meta description` only |
| Sitemap / robots | Absent | No `@astrojs/sitemap`; no `public/robots.txt` |
| React islands | None | `@astrojs/react` configured; zero `.tsx` in `src/` |
| Site URL | Documented, unused in layout | `.env.example` `PUBLIC_SITE_URL`; `src/lib/server/env.ts` |
| Landing CTA | Live | `Cta.astro` — links to `/login` (blog CTAs will use `/app`; middleware redirects anonymous users to sign-in) |
| Auth / `/app` | **Done** (F-03) | `src/middleware.ts` gates `/app/*` → `/login`; `src/pages/app/index.astro`; Supabase auth under `src/pages/api/auth/` |

### Key Discoveries

- **F-01:** Marketing and blog pages stay **static/prerendered**; only `/api/*` uses `prerender = false`.
- **F-02:** Blog content is **repo-only** — no Supabase tables for posts.
- **F-03:** Middleware gates `/app/*`; blog stays public; blog CTA wiring explicitly deferred to S-08.
- **Astro 6:** Content Layer requires `src/content.config.ts` with explicit `loader` (`glob`) and `import { z } from 'astro/zod'` — legacy `src/content/config.ts` removed.
- **Stack assessment:** Recommends Content Collections, flat blog routes, one quiz React island, server-rendered article bodies.

## Desired End State

After this plan:

1. **`/blog`** lists all published posts (title, date, optional skill/level tags, link per post).
2. **`/blog/[slug]`** serves each post without sign-in; layout varies by `type` (`static-quiz`, `open-ended`, `interactive-quiz`).
3. **Interactive post** renders markdown intro/body in HTML; quiz questions and interaction use a shared **`InteractiveQuiz`** React island (`client:visible` or `client:load`) with a score/result summary — no AI Check. (Quiz Q&A is not duplicated in server HTML in v1.)
4. **SEO:** Each page has unique `title`, `meta description`, and `<link rel="canonical">` using `PUBLIC_SITE_URL`. **`@astrojs/sitemap`** emits a sitemap for `/`, `/blog`, and all post URLs. **`public/robots.txt`** allows crawlers and references the sitemap.
5. **CTA** on index and every post points to **`/app`** with clear copy (e.g. “Practice for your role”). When F-03 middleware is live, unauthenticated `/app` requests redirect to `/login`.
6. **Footer** on landing (and blog pages) includes a link to **`/blog`**.
7. **Three founder-authored launch posts** ship in-repo (one per format).
8. **`npm run build`** and **`npm run astro -- check`** pass.

### Verification commands

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- Preview: `curl -sS https://<preview>/blog` → 200 HTML with post links
- Preview: `curl -sS https://<preview>/sitemap-index.xml` (or sitemap path Astro emits) → includes `/blog` and post URLs (**fetch sitemap directly from preview origin** — do not follow the production `Sitemap` URL in `robots.txt`)
- View source on a **static or open-ended** post: article headings in initial HTML (not empty shell). Interactive posts: intro in HTML; quiz UI hydrates via island (manual check with JS).

## What We're NOT Doing

- JSON-LD structured data (Article / Quiz) — fast-follow per planning decision
- Privacy analytics for blog → sign-in funnel
- Headless CMS, candidate-authored posts, comments, paywall
- Blog AI Check or plan-metered AI on blog pages
- Header “Blog” nav link (footer only in v1)
- Theme toggle / persisted preference (S-06) — inherit OS `prefers-color-scheme` from `global.css`
- MDX unless a launch post cannot be authored in markdown + frontmatter
- Automated test harness (manual quiz verification)
- Changes to practice generation, Stripe, or Supabase schema
- `AGENTS.md` blog section (optional fast-follow; not blocking S-08)

## Implementation Approach

Use Astro 6 **Content Layer** with a single `blog` collection (`src/content/blog/*.md`), Zod schema with a `type` discriminator and optional `quiz` array for interactive posts. Prerender **`src/pages/blog/index.astro`** and **`src/pages/blog/[slug].astro`** via `getStaticPaths` from collection entries (`entry.id` as slug segment). Extend **`Layout.astro`** for canonical URLs. Add **`@astrojs/sitemap`** with `site` derived from `PUBLIC_SITE_URL` at build time. Extract a small **`BlogPostLayout.astro`** (or equivalent) for shared post chrome (title, date, tags, CTA). Implement **`InteractiveQuiz.tsx`** as the first React island; keep scoring logic in a pure TS module colocated for future unit tests. Reuse landing design tokens (`var(--*)`, `.btn-primary`) for visual consistency.

## Critical Implementation Details

**Astro 6 entry IDs:** Collection entries use **`entry.id`** (path-based), not legacy `entry.slug`. Dynamic route param should match the URL segment you choose in frontmatter or derived from `id` (e.g. strip `.md` / path prefix). Verify `getStaticPaths` params align with `getEntry('blog', slug)`.

**CTA vs F-03:** F-03 is **done** — blog CTAs can target `/app` safely (middleware redirects unauthenticated users to `/login`). Landing `Cta.astro` uses `/login` directly; blog chrome should use `/app` per PRD funnel copy.

**Build-time `site` URL:** `astro.config.mjs` `site` must be a valid absolute URL for sitemap and canonical generation. Use `process.env.PUBLIC_SITE_URL` or `import.meta.env.PUBLIC_SITE_URL` at config evaluation time; fail the build with a clear message if missing in CI/production contexts (local dev may default to `http://localhost:4321` only if documented in plan verification).

## Phase 1: Content layer and config

### Overview

Add dependencies, Astro `site` config, and the blog content collection schema so posts can be authored and type-checked at build time.

### Changes Required:

#### 1. Sitemap integration dependency

**File**: `package.json`

**Intent**: Enable automatic sitemap generation (FR-030).

**Contract**: Add `@astrojs/sitemap` compatible with Astro 6.x (match major of `astro` in lockfile). Register in `astro.config.mjs` `integrations` array alongside `react()`.

#### 2. Astro site URL and sitemap

**File**: `astro.config.mjs`

**Intent**: Provide canonical base URL for sitemap and metadata.

**Contract**: Set `site` to production origin from `PUBLIC_SITE_URL` (trimmed, no trailing slash). Integrate `sitemap()` from `@astrojs/sitemap`. Do not change `output` mode or `adapter` options.

#### 3. Blog content collection

**File**: `src/content.config.ts` (create)

**Intent**: Define the blog collection with Astro 6 Content Layer API.

**Contract**:

- Import `defineCollection` from `astro:content`, `glob` from `astro/loaders`, `z` from `astro/zod`.
- Collection key: `blog`.
- Loader: `glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' })` (prefer `.md` only unless MDX needed).
- Schema fields (all posts): `title` (string), `description` (string), `pubDate` (coerce date), `type` (enum: `static-quiz` | `open-ended` | `interactive-quiz`), optional `tags` (array of strings — skill/level labels).
- Interactive posts only: `quiz` — array of objects: `question` (string), `options` (array of strings, min length 2), `correctIndex` (number/int within options range). Enforce with `.refine()` or `z.discriminatedUnion` so `quiz` is required when `type === 'interactive-quiz'` and omitted otherwise.

#### 4. Content directory placeholder

**File**: `src/content/blog/.gitkeep` or first stub post (optional in this phase)

**Intent**: Establish directory convention for founder-authored posts.

**Contract**: Directory exists; no posts required until Phase 5 (Phase 4 may use a temporary dev post for layout work — remove or replace before merge).

### Success Criteria:

#### Automated Verification:

- `npm run build` completes with exit code 0
- `npm run astro -- check` completes with exit code 0
- Invalid frontmatter (e.g. interactive post without `quiz`) fails `astro check` or build with a schema error

#### Manual Verification:

- `PUBLIC_SITE_URL` documented as required for production-like builds in change verification notes

**Implementation Note**: Pause after automated checks before Phase 2.

---

## Phase 2: SEO and site chrome

### Overview

Extend the document shell for canonical URLs, generate sitemap, add `robots.txt`, and link the blog from the landing footer.

### Changes Required:

#### 1. Layout SEO props

**File**: `src/layouts/Layout.astro`

**Intent**: Support FR-029 canonical URLs and per-page metadata.

**Contract**: Add optional prop `canonicalPath?: string` (pathname only, e.g. `/blog/java-mid-quiz`). When set, emit `<link rel="canonical" href={absoluteUrl} />` where `absoluteUrl = site + canonicalPath` (use Astro `new URL(canonicalPath, Astro.site)` or equivalent). Keep existing `title` / `description` behavior and `pageTitle` suffix rule.

#### 2. Site URL helper (optional)

**File**: `src/lib/site-url.ts` (create, if avoids duplicating URL logic)

**Intent**: Single place to resolve public site origin for layouts and future use.

**Contract**: Export function returning origin string from `import.meta.env.PUBLIC_SITE_URL` with dev fallback only if explicitly chosen; do not log env values.

#### 3. Robots file

**File**: `public/robots.txt` (create)

**Intent**: Allow indexing and point crawlers at sitemap.

**Contract**: `User-agent: *` / `Allow: /` and `Sitemap: https://prepahead.dev/sitemap-index.xml` (or path matching `@astrojs/sitemap` output — verify after build). Use production host from deploy docs, not localhost. **Preview note:** this file is static and always references the production sitemap; that is intentional (previews should not drive crawler discovery). Do not use the robots `Sitemap` line to verify Preview sitemap contents.

#### 4. Footer blog link

**File**: `src/components/landing/Footer.astro`

**Intent**: Footer-only discovery path to blog (planning decision).

**Contract**: Add accessible link to `/blog` (e.g. “Interview blog” or “Blog”) alongside existing footer content. Do not modify `Header.astro` nav in v1.

#### 5. Sitemap filter (if needed)

**File**: `astro.config.mjs` or sitemap integration config

**Intent**: Exclude on-demand API routes from sitemap.

**Contract**: Sitemap includes prerendered pages (`/`, `/blog`, `/blog/*`). Exclude `/api/*` if the integration would otherwise list them.

### Success Criteria:

#### Automated Verification:

- `npm run build` produces sitemap artifact(s) under `dist/` (path per Astro 6 sitemap docs)
- `npm run astro -- check` passes

#### Manual Verification:

- Built HTML for a test page includes `rel="canonical"` when `canonicalPath` passed
- `robots.txt` served at `/robots.txt` on preview
- Landing footer shows link to `/blog`

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Blog routes

### Overview

Add prerendered blog index and dynamic post route wired to the content collection.

### Changes Required:

#### 1. Blog index page

**File**: `src/pages/blog/index.astro` (create)

**Intent**: FR-024 — list published posts.

**Contract**: `getCollection('blog')`; sort by `pubDate` descending; render title, formatted date, optional tags, link to `/blog/${entry.id}` (confirm id format matches slug route). Use `Layout` with `title` “Interview blog” (or similar), `description` for index, `canonicalPath` `/blog`. Include site-appropriate intro copy (one short paragraph). Include primary CTA to `/app`.

#### 2. Dynamic post route

**File**: `src/pages/blog/[slug].astro` (create)

**Intent**: FR-025 — full post without sign-in.

**Contract**: `export async function getStaticPaths()` mapping each blog entry to `{ params: { slug } }` using stable slug from `entry.id`. In page frontmatter, `getEntry('blog', slug)`; 404 or `Astro.redirect` if missing. Pass post `title`, `description`, `canonicalPath` `/blog/${slug}` to `Layout`. Delegate body rendering to type-specific layout component (Phase 4) — stub minimal body in Phase 3 if needed, replaced in Phase 4.

#### 3. Shared blog chrome (shell)

**File**: `src/components/blog/BlogChrome.astro` or `BlogPostLayout.astro` (create)

**Intent**: Consistent post header/footer and CTA across formats.

**Contract**: Accept post metadata props; render `<article>` wrapper, `<h1>`, date, tags; slot for body; CTA block linking to `/app` with copy aligned to PRD funnel (role-specific practice, not generic “sign up”). Reuse footer component from landing or duplicate minimal footer with blog link.

### Success Criteria:

#### Automated Verification:

- `npm run build` generates `/blog/index.html` and one HTML file per collection entry
- `npm run astro -- check` passes

#### Manual Verification:

- `/blog` lists posts when at least one markdown file exists
- Unknown slug returns 404 page (not 500)
- Index and post pages use theme tokens; readable on mobile width

**Implementation Note**: Pause before Phase 4.

---

## Phase 4: Post formats and interactive quiz island

### Overview

Implement three post layouts and the reusable interactive quiz React island with server-rendered article content.

### Changes Required:

#### 1. Static quiz layout

**File**: `src/components/blog/StaticQuizPost.astro` (create)

**Intent**: FR-026 — questions and answers in post content.

**Contract**: Render `await render(entry)` body (or `<Content />` from render result) inside article styles. Content is markdown-authored Q&A (founder formats headings/lists). No client JS required. Optional short note that AI Check is available after sign-in (honest scope — no Check on blog).

#### 2. Open-ended layout

**File**: `src/components/blog/OpenEndedPost.astro` (create)

**Intent**: FR-027 — open-ended prompts without AI grading.

**Contract**: Same render pattern as static quiz; copy guardrail that critical feedback is in signed-in practice. No text inputs that imply Check.

#### 3. Quiz scoring module

**File**: `src/lib/blog/score-quiz.ts` (create)

**Intent**: Pure scoring for interactive posts (future unit tests).

**Contract**: Export `scoreQuiz(questions, selectedIndices)` returning `{ correct, total, percent }` or equivalent for UI summary. No side effects; no logging of answers.

#### 4. Interactive quiz island

**File**: `src/components/blog/InteractiveQuiz.tsx` (create)

**Intent**: FR-028 — in-page selection and result summary.

**Contract**: Props: quiz array matching schema. Client UI: one question at a time or scrollable list; radio/select per question; submit shows summary using `scoreQuiz`. Use `client:visible` (preferred for performance) or `client:load` if needed for short posts. Do not fetch APIs; no Supabase.

#### 5. Interactive post layout

**File**: `src/components/blog/InteractiveQuizPost.astro` (create)

**Intent**: Wire island to collection entry.

**Contract**: Render optional markdown intro via `render()`; mount `<InteractiveQuiz client:visible quiz={entry.data.quiz} />`. Article HTML for intro must appear in server output.

#### 6. Post route dispatch

**File**: `src/pages/blog/[slug].astro` (update)

**Intent**: Select layout by `entry.data.type`.

**Contract**: `switch`/conditional importing `StaticQuizPost`, `OpenEndedPost`, or `InteractiveQuizPost`. Default: build-time error or skip unknown types via schema enum.

#### 7. Prose / typography styles

**File**: `src/styles/global.css` or `src/styles/blog.css` (create, imported from layout or post wrapper)

**Intent**: Readable long-form content matching landing quality.

**Contract**: Styles for `article` headings, lists, code inline, spacing — use existing CSS variables. Avoid multi-second layout shift on load.

### Success Criteria:

#### Automated Verification:

- `npm run build` succeeds with interactive post in collection
- `npm run astro -- check` passes

#### Manual Verification:

- Static and open-ended posts: full article visible with JS disabled
- Interactive post: answer all questions, submit, see result summary
- No console errors; mobile layout acceptable
- CTA visible on all three formats

**Implementation Note**: Pause before Phase 5 content + final verification.

---

## Phase 5: Launch posts and verification

### Overview

Author three real launch posts, run full build/check, and complete manual SEO and funnel smoke tests.

### Changes Required:

#### 1. Launch post — static quiz

**File**: `src/content/blog/<slug-static>.md` (create)

**Intent**: FR-026 launch content.

**Contract**: `type: static-quiz`; real Java (or chosen skill) mid-level interview Q&A (~10 questions); `title`, `description`, `pubDate`, `tags`; quality suitable for public index (no lorem).

#### 2. Launch post — open-ended

**File**: `src/content/blog/<slug-open>.md` (create)

**Intent**: FR-027 launch content.

**Contract**: `type: open-ended`; behavioral or architecture prompts list; honest framing about Check in app.

#### 3. Launch post — interactive quiz

**File**: `src/content/blog/<slug-interactive>.md` (create)

**Intent**: FR-028 launch content.

**Contract**: `type: interactive-quiz`; valid `quiz` frontmatter array; short intro markdown body.

#### 4. Deploy verification notes

**File**: `context/changes/public-blog-and-seo/verification.md` (create, optional)

**Intent**: Record Preview URL checks for implementer/reviewer.

**Contract**: Checklist: index lists 3 posts; sitemap contains URLs (fetch on preview origin); canonical tags; robots.txt (production sitemap URL only); CTA `/app`; view-source HTML; F-03 redirect note.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- All three post types reachable from `/blog`
- Sitemap includes `/`, `/blog`, and three post URLs on Preview (curl preview origin `/sitemap-index.xml` directly)
- Unique title and description per post (browser tab + meta)
- CTA navigates to `/app` (redirect to login when F-03 live)
- No JD/CV or user data on blog pages
- Landing regression: `/` still builds and footer blog link works
- Blog pages readable in light and dark (OS preference)

**Implementation Note**: Final phase — confirm with human before marking change complete.

---

## Testing Strategy

### Unit Tests

- Not in repo scope for S-08. When Vitest is added, prioritize `src/lib/blog/score-quiz.ts`.

### Integration Tests

- None (no Playwright). Rely on build + manual smoke.

### Manual Testing Steps

1. Open `/blog` — three posts listed with sensible titles and dates.
2. Open each post type — content renders; interactive quiz completes with summary.
3. Disable JS — static and open-ended posts still readable; interactive shows intro with JS disabled (quiz submit requires JS — acceptable for FR-028).
4. Inspect `<head>` — `title`, `description`, `canonical` on index and posts.
5. Fetch `/sitemap-index.xml` on the **preview deployment origin** — blog URLs present (do not use the production URL from `robots.txt`).
6. Click CTA → `/app` → login redirect when F-03 deployed.
7. Run `npm run build` and `npm run astro -- check` locally.

## Performance Considerations

- All blog pages prerendered — no server TTFB dependency for article HTML.
- Interactive island hydrates on visibility — keeps initial HTML crawler-friendly.
- Keep post images minimal in v1; if images added later, use Astro assets and dimensions to avoid CLS.
- Avoid loading Google Fonts twice if blog layout reuses `Layout.astro` (already loads Inter).

## Migration Notes

- No database migration.
- New env requirement: `PUBLIC_SITE_URL` must be set in Vercel for correct canonicals and sitemap on Preview/Production.
- Coordinate merge/deploy with **F-03** for `/app` CTA behavior — **F-03 is done**; blog CTAs to `/app` work in Preview/Production today.

## References

- PRD blog FRs: `context/foundation/prd.md` (FR-024–FR-032, US-05)
- Roadmap S-08: `context/foundation/roadmap.md`
- Shape notes: `context/foundation/shape-notes.md`
- Stack guidance: `context/foundation/stack-assessment.md`
- F-01 static/API split: `context/changes/server-api-foundation/plan.md`
- F-03 auth CTA target: `context/changes/supabase-oauth-auth/plan-brief.md`
- Landing patterns: `src/layouts/Layout.astro`, `src/components/landing/`
- Astro 6 content layer: https://docs.astro.build/en/guides/content-collections/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Content layer and config

#### Automated

- [ ] 1.1 `npm run build` completes with exit code 0
- [ ] 1.2 `npm run astro -- check` completes with exit code 0
- [ ] 1.3 Invalid frontmatter fails check or build with schema error

#### Manual

- [ ] 1.4 `PUBLIC_SITE_URL` documented for production-like builds

### Phase 2: SEO and site chrome

#### Automated

- [ ] 2.1 `npm run build` produces sitemap artifact(s)
- [ ] 2.2 `npm run astro -- check` passes

#### Manual

- [ ] 2.3 Canonical `link` present when `canonicalPath` set
- [ ] 2.4 `robots.txt` served on preview
- [ ] 2.5 Landing footer links to `/blog`

### Phase 3: Blog routes

#### Automated

- [ ] 3.1 Build generates `/blog` and per-slug HTML
- [ ] 3.2 `npm run astro -- check` passes

#### Manual

- [ ] 3.3 `/blog` lists posts; unknown slug 404
- [ ] 3.4 Mobile-readable index and stub post

### Phase 4: Post formats and interactive quiz island

#### Automated

- [ ] 4.1 `npm run build` succeeds with interactive post
- [ ] 4.2 `npm run astro -- check` passes

#### Manual

- [ ] 4.3 Static/open-ended readable with JS disabled
- [ ] 4.4 Interactive quiz shows result summary
- [ ] 4.5 CTA visible on all formats

### Phase 5: Launch posts and verification

#### Automated

- [ ] 5.1 `npm run build` — exit 0
- [ ] 5.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 5.3 Three launch posts listed and reachable
- [ ] 5.4 Sitemap includes blog URLs on Preview (fetch `/sitemap-index.xml` on preview origin directly)
- [ ] 5.5 Per-post title, description, canonical verified
- [ ] 5.6 CTA `/app` behavior verified (with F-03 note)
- [ ] 5.7 No user data on blog; landing regression OK
- [ ] 5.8 Light/dark readability on blog pages
