---
project: PrepAhead.dev
version: 2
status: draft
created: 2026-05-26
context_type: brownfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

**Purpose:** PrepAhead.dev is an interview-prep web MVP: signed-in candidates paste a job description (optional CV), generate role-specific practice sets (~15 ABCD + ~5 open-ended), use Check for open-ended feedback, and operate under FREE/PRO plans with payment-provider billing and usage metering.

**Architecture:** Web application with marketing landing, authenticated practice flows, and server-backed generation and billing. Blog/content hub does not exist today.

**Tech stack:** Existing MVP stack unchanged for this change (details in stack assessment / implementation planning).

**User base:** Individual junior/mid-level IT/software candidates preparing for a specific role interview — small scale for MVP.

**Core functionality today:** Sign-in, JD-based question generation, mixed practice (ABCD + open-ended + Check), plan-tier usage limits, practice history, light/dark theme on marketing and signed-in surfaces. No public blog or indexable content hub.

## Problem Statement & Motivation

**Gap:** Core product value sits behind sign-in. Without indexable interview-prep content on prepahead.dev, the site cannot earn organic search traffic from candidates actively looking for practice material.

**Change:** Add a **blog module** as part of the MVP — publish valuable, interview-related posts (e.g., a 10-question Java quiz at a stated level, posts with open-ended interview questions).

**Why now:** Start building **organic SEO** early on the owned domain instead of waiting or relying only on external publishing channels.

**Insight:** Owning the SEO surface on prepahead.dev lets long-term organic discovery compound on the same domain as the practice product.

**Current workaround:** Candidates find generic interview content elsewhere; PrepAhead is discovered only through direct visits or non-owned channels — no owned-domain content funnel.

## User & Persona

**Primary persona (unchanged):** "Role-focused IT candidate" (Alex) — junior or mid-level software engineer actively preparing for a specific role.

**How this change affects them:** Blog content serves the same person when they search for interview questions and quizzes **before or alongside** JD-based practice.

**New moment:** Finds PrepAhead via search for role- or skill-specific interview content (e.g., Java mid-level quiz), reads a post, and may later sign in for JD-tailored practice.

## Success Criteria

### Primary

- Anonymous visitor reaches a **blog index** on prepahead.dev listing published posts.
- Visitor opens a post — at least one each of: **static quiz article** (e.g., 10 Java questions at a stated level), **open-ended question article**, and **interactive quiz** (in-page answer selection + score or result summary).
- Blog pages ship with **SEO basics** (unique titles, meta descriptions, clean URLs) so search engines can index content.
- Visitor can follow a **CTA** from blog content to sign in and use JD-based practice (existing app flow unchanged).

### Secondary

- At least **2–3 posts** live at launch beyond the index (mix of formats above).

### Guardrails

- **Existing product preserved:** Sign-in, practice generation, Check, FREE/PRO billing, and landing CTAs continue to work.
- **Public vs private:** Blog shows only editorial content; no user JD/CV or practice history on blog pages.
- **Theme:** Blog pages support light/dark consistently with the rest of the site.
- **Honest scope:** Blog open-ended posts do not imply in-blog AI Check — that remains in the signed-in product unless explicitly added later.

## User Stories

### US-01: Discover interview content and reach practice

- **Before:** Visitors could reach marketing and sign-in but had no on-site interview-prep articles to read or rank in search.
- **Given** an anonymous visitor arriving from search or the site nav
- **When** they open the blog index, read a post (static quiz, open-ended, or interactive quiz), and choose the CTA to try role-specific practice
- **Then** they reach the existing sign-in / JD practice entry point without needing an account to read the post

#### Acceptance Criteria

- Blog index lists all v1 launch posts with readable titles and links
- Interactive quiz post allows answering all questions and shows a result summary without sign-in
- SEO metadata is present on index and post pages
- CTA is visible on blog posts and routes to the existing practice onboarding path
- No user JD/CV or practice-set data appears on blog pages

## Scope of Change

### Blog discovery & reading

- [new] FR-001: Visitor can view a blog index listing published posts. Priority: must-have
  > Socrates: Counter-argument: empty or stale index hurts credibility before enough posts exist. Resolution: kept — launch criterion requires 2–3 posts live; do not ship an empty index.
- [new] FR-002: Visitor can read a full blog post without signing in. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Blog content formats

- [new] FR-003: Visitor can read a static quiz article (interview questions with answers provided in the post content). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-004: Visitor can read an open-ended interview-question article. Priority: must-have
  > Socrates: Counter-argument: without Check/AI feedback, open-ended posts feel shallow vs the app. Resolution: kept — blog educates and ranks; critical feedback remains in signed-in practice; guardrail in Success Criteria.
- [new] FR-005: Visitor can complete an interactive quiz on a blog post (select answers and see a result summary). Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### SEO & funnel

- [new] FR-006: Each published blog post exposes indexable SEO metadata (title, description, canonical URL). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-007: Site exposes a sitemap (or equivalent discoverable URL list) that includes blog post URLs. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-008: Visitor can follow a call-to-action from blog content to the sign-in / JD practice flow. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Authoring & appearance

- [modified] FR-009: Visitor sees blog pages in light or dark mode consistent with the site theme. Priority: must-have
  > Socrates: Counter-argument: theme work on blog delays shipping SEO content. Resolution: kept — product standard requires theme on all surfaces including blog (extends existing theme requirements).
- [new] FR-010: Founder can add and publish blog posts by adding content to the repository (static/markdown). Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Preserved product behavior

- [preserved] FR-011: Candidate can use the existing JD-based practice flow (sign-in, generation, Check, plans) without regression from the blog release. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## Constraints & Compatibility

**Backward compatibility:**

- No breaking changes to existing API routes, auth callbacks, or billing webhooks.
- Practice APIs and sign-in flows unchanged for existing users.

**Deployment:**

- Blog ships with the existing site deployment — no deployment-target change.

**Data:**

- No migration of user data; blog content is separate static editorial content.

**Preserved behavior (must not break):**

- Sign-in + JD practice flow (generations, Check, plan limits).
- Existing marketing landing and navigation path to sign-in.
- FREE/PRO billing and usage metering.
- Light/dark theme consistency across surfaces (including new blog pages).
- Privacy: JD/CV and user practice data remain private; blog shows editorial content only.

**Timeline note:** Blog v1 scope (static quiz, open-ended articles, interactive quiz, SEO basics, CTA) exceeds a static-only SEO slice while targeting ~3 weeks after-hours; sustained-effort / slip risk was explicitly accepted on 2026-05-26.

**Quality properties for this change:**

- **Blog read performance:** Blog index and post pages feel snappy on mobile for typical post length (binary: no multi-second blank screen before readable content).
- **SEO-friendly markup:** Post content and headings are available in server-rendered HTML suitable for crawlers (not JS-only article bodies).
- **Existing practice qualities preserved:** Generation responsiveness, data isolation, billing integrity, and theme readability for signed-in flows must not regress.

## Business Logic Changes

**Existing rule (unchanged):** From a specific job description and optional CV text, PrepAhead derives role-relevant interview topics and generates a mixed practice set, gating generation and Check actions by plan limits.

**New rule (blog module):** PrepAhead publishes curated, skill- and level-tagged interview content structured for search discovery, with optional in-post interactive scoring on quiz posts — personalization from the visitor's JD remains in the signed-in app, not on the blog.

**Supporting detail:**

- **Inputs (user-facing):** Editorial post content; visitor selections on interactive quiz posts.
- **Output:** Readable articles (static quiz, open-ended lists, interactive quiz with result summary); indexable pages with metadata; CTA path to sign-in.
- **User encounter:** Search or nav → blog index → post → (optional quiz interaction) → CTA → existing practice flow.
- **Boundary:** Blog does not consume or display user JD/CV; does not run Check or plan-metered AI on blog pages in v1.

## Access Control Changes

**No access control changes — current candidate auth model preserved.**

**Blog-specific behavior (additive):**

- **Read:** All blog posts are public — anonymous visitors and search crawlers can read full content without signing in.
- **Authoring (v1):** Founder-authored static content deployed with the site; no new author roles, no signed-in candidate publishing.

Existing model unchanged: authenticated candidates use existing sign-in; flat user model; FREE/PRO plan tier gates practice-set generation and Check usage.

## Non-Goals

- **User-generated content:** No candidate-authored posts, comments, or forums in v1.
- **Headless CMS / heavy editorial stack:** No CMS integration or complex publish workflow in v1 — repo-based static posts only.
- **Blog AI Check:** No Check-style AI grading on blog open-ended content in v1.
- **Paywalled blog:** All launch posts remain free to read.
- **Multi-language blog:** English-only (or single-locale) content in v1.
- **Rewrite core app for blog:** No redesign of auth, practice flow, or billing driven by blog work.

## Open Questions

1. **Interactive quiz format** — Single reusable quiz component vs per-post custom markup? Resolve during implementation planning.
2. **Structured data** — Structured markup (Article, FAQ, Quiz) for rich search results — include in v1 or fast-follow?
3. **Analytics** — Privacy-friendly traffic measurement for blog → sign-in funnel (tool choice deferred).
4. **Post URL scheme** — Flat `/blog/[slug]` vs topic hierarchy — resolve during implementation.
