---
project: PrepAhead.dev
context_type: brownfield
created: 2026-05-26
updated: 2026-05-26
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: context_type
      decision: brownfield — blog module added to existing PrepAhead MVP
    - topic: change_category
      decision: new module — public blog alongside existing practice app
    - topic: product_insight
      decision: own SEO surface on prepahead.dev early rather than relying on external channels only
    - topic: blog_audience
      decision: same primary persona as app — role-focused IT candidate (junior/mid)
    - topic: blog_read_access
      decision: fully public read — no login required (SEO)
    - topic: auth_model_change
      decision: no change — Google sign-in + flat user model preserved
    - topic: blog_authoring
      decision: founder-authored static content in repo for v1 — no candidate author accounts
    - topic: mvp_slice
      decision: blog index + initial posts + SEO basics; expanded to include interactive quiz + static quiz + open-ended + CTA in v1
    - topic: mvp_timeline
      decision: target ~3 weeks after-hours with explicit acceptance of slip risk due to full interactive scope
  frs_drafted: 11
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# Shape notes — PrepAhead.dev (blog module)

Seed idea (verbatim): I want to add blog as part of the mvp. The purpose of the blog is to create valuable blog posts related to interview questions. For example, quiz with 10 java x level questions or some post with open-ended questions. The main purpose to deploy blog as the part of the mvp is to start building organic seo early

## Current System

**Product:** PrepAhead.dev — interview-prep web MVP. Signed-in candidates paste a job description (optional CV), generate role-specific practice sets (~15 ABCD + ~5 open-ended), use Check for open-ended feedback, and operate under FREE/PRO plans with Stripe billing and usage metering.

**Surfaces today:** Marketing landing and signed-in practice flows. No public blog or indexable content hub.

**Tech stack:** Existing MVP stack unchanged for this change (implementation detail deferred to stack assessment / planning).

**Users today:** Individual junior/mid-level IT/software candidates preparing for a specific role interview.

## Vision & Problem Statement

**Delta — what's changing:** Add a **blog module** as part of the MVP — publish valuable, interview-related posts (e.g., a 10-question Java quiz at a stated level, posts with open-ended interview questions) on prepahead.dev.

**Why now:** Start building **organic SEO** early on the owned domain instead of waiting or relying only on external publishing channels.

**Pain addressed:** The product's core value sits behind sign-in; without indexable interview-prep content, the site cannot earn search traffic from candidates actively looking for practice material.

**Insight:** Owning the SEO surface on prepahead.dev lets long-term organic discovery compound on the same domain as the practice product.

## User & Persona

**Primary persona (unchanged):** "Role-focused IT candidate" (Alex) — junior or mid-level software engineer actively preparing for a specific role; blog content serves the same person when they are searching for interview questions and quizzes before or alongside using JD-based practice.

**Blog moment:** Finds PrepAhead via search for role- or skill-specific interview content (e.g., Java mid-level quiz), reads a post, and may later sign in for JD-tailored practice.

## Constraints & Preserved Behavior

**Must preserve (explicit):**

- Sign-in + JD practice flow (generations, Check, plan limits) — unchanged behavior.
- Existing marketing landing and navigation path to sign-in.
- Stripe FREE/PRO billing and usage metering.
- Light/dark theme consistency across surfaces (including new blog pages).
- Privacy: JD/CV and user practice data remain private; blog content is editorial/public only — no leakage of per-user practice data.

**Extended (blog release):**

- **Deployment:** Blog ships with existing Astro/Vercel deployment — no deployment-target change.
- **Backward compatibility:** No breaking changes to existing API routes, auth callbacks, or Stripe webhooks.
- **Data:** No migration of user data; blog content is separate static assets/markdown.
- **API consumers:** N/A for public blog; practice APIs unchanged.

## Access Control

**Current model (unchanged):** Candidates sign in with Google (Supabase Auth). Flat user model — no admin/member/guest roles in MVP. FREE/PRO plan tier gates practice-set generation and Check usage, not separate RBAC.

**Blog read access:** All blog posts are **public** — anonymous visitors and search crawlers can read full content without signing in.

**Blog authoring (v1):** **Founder-authored static content** deployed with the site (e.g., markdown in repo). No new author roles, no signed-in candidate publishing, no change to candidate auth.

**No changes planned — current candidate auth model preserved.**

## Success Criteria

### Primary

1. Anonymous visitor reaches a **blog index** on prepahead.dev listing published posts.
2. Visitor opens a post — at least one each of: **static quiz article** (e.g., 10 Java questions at a stated level), **open-ended question article**, and **interactive quiz** (in-page answer selection + score or result summary).
3. Blog pages ship with **SEO basics** (unique titles, meta descriptions, clean URLs) so search engines can index content.
4. Visitor can follow a **CTA** from blog content to sign in and use JD-based practice (existing app flow unchanged).

### Secondary

- At least **2–3 posts** live at launch beyond the index (mix of formats above).

### Guardrails

- **Existing product preserved:** Sign-in, practice generation, Check, FREE/PRO billing, and landing CTAs continue to work.
- **Public vs private:** Blog shows only editorial content; no user JD/CV or practice history on blog pages.
- **Theme:** Blog pages support light/dark consistently with the rest of the site.
- **Honest scope:** Blog open-ended posts do not imply in-blog AI Check — that remains in the signed-in product unless explicitly added later.

## Timeline acknowledgment

Acknowledged on 2026-05-26: Blog v1 includes static quiz posts, open-ended articles, **interactive quiz**, SEO basics, and product CTA — scoped larger than static-only SEO slice while keeping **~3 weeks** on the timeline; user **accepted sustained-effort / slip risk** if delivery runs long alongside the rest of the MVP.

## Functional Requirements

### Blog discovery & reading

- FR-001: Visitor can view a blog index listing published posts. Priority: must-have. Change: new
  > Socrates: Counter-argument: empty or stale index hurts credibility before enough posts exist. Resolution: kept — launch criterion requires 2–3 posts live; do not ship an empty index.
- FR-002: Visitor can read a full blog post without signing in. Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.

### Blog content formats

- FR-003: Visitor can read a static quiz article (interview questions with answers provided in the post content). Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.
- FR-004: Visitor can read an open-ended interview-question article. Priority: must-have. Change: new
  > Socrates: Counter-argument: without Check/AI feedback, open-ended posts feel shallow vs the app. Resolution: kept — blog educates and ranks; critical feedback remains in signed-in practice; guardrail in Success Criteria.
- FR-005: Visitor can complete an interactive quiz on a blog post (select answers and see a result summary). Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.

### SEO & funnel

- FR-006: Each published blog post exposes indexable SEO metadata (title, description, canonical URL). Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.
- FR-007: Site exposes a sitemap (or equivalent discoverable URL list) that includes blog post URLs. Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.
- FR-008: Visitor can follow a call-to-action from blog content to the sign-in / JD practice flow. Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.

### Authoring & appearance

- FR-009: Visitor sees blog pages in light or dark mode consistent with the site theme. Priority: must-have. Change: modified
  > Socrates: Counter-argument: theme work on blog delays shipping SEO content. Resolution: kept — product standard requires theme on all surfaces including blog (extends existing theme FRs).
- FR-010: Founder can add and publish blog posts by adding content to the repository (static/markdown). Priority: must-have. Change: new
  > Socrates: No counter-argument; it stands as written.

### Preserved product behavior

- FR-011: Candidate can use the existing JD-based practice flow (sign-in, generation, Check, plans) without regression from the blog release. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; it stands as written.

## User Stories

### US-01: Discover interview content and reach practice

- **Given** an anonymous visitor arriving from search or the site nav
- **When** they open the blog index, read a post (static quiz, open-ended, or interactive quiz), and choose the CTA to try role-specific practice
- **Then** they reach the existing sign-in / JD practice entry point without needing an account to read the post

#### Acceptance Criteria

- Blog index lists all v1 launch posts with readable titles and links
- Interactive quiz post allows answering all questions and shows a result summary without sign-in
- SEO metadata is present on index and post pages
- CTA is visible on blog posts and routes to the existing practice onboarding path
- No user JD/CV or practice-set data appears on blog pages

## Business Logic

**Existing rule (unchanged):** From a specific job description and optional CV text, PrepAhead derives role-relevant interview topics and generates a mixed practice set, gating generation and Check actions by plan limits.

**New rule (blog module):** PrepAhead publishes **curated, skill- and level-tagged interview content** structured for **search discovery**, with optional **in-post interactive scoring** on quiz posts — **personalization from the visitor's JD remains in the signed-in app**, not on the blog.

Supporting detail:

- **Inputs (user-facing):** Editorial post content (markdown/static); visitor selections on interactive quiz posts.
- **Output:** Readable articles (static quiz, open-ended lists, interactive quiz with result summary); indexable pages with metadata; CTA path to sign-in.
- **User encounter:** Search or nav → blog index → post → (optional quiz interaction) → CTA → existing practice flow.
- **Boundary:** Blog does not consume or display user JD/CV; does not run Check or plan-metered AI on blog pages in v1.

## Non-Functional Requirements

- **Blog read performance:** Blog index and post pages feel snappy on mobile for typical post length (binary: no multi-second blank screen before readable content).
- **SEO-friendly markup:** Post content and headings are available in server-rendered HTML suitable for crawlers (not JS-only article bodies).
- **Existing practice NFRs preserved:** Generation responsiveness, data isolation, billing integrity, and theme readability for signed-in flows must not regress.

## Non-Goals

- **User-generated content:** No candidate-authored posts, comments, or forums in v1.
- **Headless CMS / heavy editorial stack:** No CMS integration or complex publish workflow in v1 — repo-based static posts only.
- **Blog AI Check:** No Check-style AI grading on blog open-ended content in v1.
- **Paywalled blog:** All launch posts remain free to read.
- **Multi-language blog:** English-only (or single-locale) content in v1.
- **Rewrite core app for blog:** No redesign of auth, practice flow, or billing driven by blog work.

## Quality cross-check

Re-checked 2026-05-26: Access Control present; Business Logic has one-sentence new rule; timeline acknowledgment present for expanded scope; Non-Goals populated; Constraints & Preserved Behavior names must-not-break items. All elements present — **accepted**.

## Open Questions

- **Interactive quiz format:** Single reusable quiz component vs per-post custom markup — resolve during implementation planning.
- **Structured data:** JSON-LD (Article, FAQ, Quiz) for rich results — include in v1 or fast-follow?
- **Analytics:** Privacy-friendly traffic measurement for blog → sign-in funnel (tool choice deferred).
- **Post URL scheme:** `/blog/[slug]` vs topic hierarchy — resolve during implementation.
