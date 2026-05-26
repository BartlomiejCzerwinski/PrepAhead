---
project: PrepAhead.dev
version: 1
status: draft
created: 2026-05-26
updated: 2026-05-26
prd_version: 1
main_goal: speed
top_blocker: decisions
---

# Roadmap: PrepAhead.dev

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Junior and mid-level software engineer candidates prep for a specific role using generic lists that do not match the job posting. PrepAhead turns a pasted job description (and optional CV) into a mixed ABCD and open-ended practice set with Check feedback on open answers, under FREE or PRO usage limits.

The product wedge — the trait that, if removed, makes PrepAhead a generic AI quiz tool — is that questions and Check feedback must stay grounded in the candidate's own pasted job description (and optional CV), not a disconnected question bank. A public blog on prepahead.dev publishes curated interview content for organic search while JD-tailored practice stays behind sign-in.

## North star

**S-02: Generate a JD-grounded practice set** — Proves the core hypothesis that pasted JD (+ optional CV) yields a ~20-question mixed set within plan limits.

> **North star** here means the smallest end-to-end slice whose delivery would prove the product works — placed as early as prerequisites allow because later slices only matter if generation is real. Full **US-01** (generate and complete a set) also requires **S-03** (ABCD loop) and **S-04** (Check); those follow immediately after **S-02**.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | server-api-foundation | (foundation) run server endpoints on Vercel for AI, auth callbacks, and billing | — | NFR (generation responsiveness), Access Control | ready |
| F-02 | supabase-data-schema | (foundation) persist users, plans, usage, practice sets, and theme preference | — | NFR (data isolation), Access Control | ready |
| F-03 | supabase-oauth-auth | (foundation) sign in via Google OAuth; sessions protect practice routes | F-01, F-02 | FR-001, Access Control | proposed |
| S-01 | sign-in-and-usage-dashboard | sign in and see FREE plan with remaining generations and Check calls | F-01, F-02, F-03 | FR-001, FR-012, US-02 | proposed |
| S-02 | jd-gated-generation | paste a JD (and optional CV), request generation, and receive a ~20-question set within limits | S-01 | FR-002, FR-003, FR-004, FR-014, FR-015, US-01 | blocked |
| S-03 | abcd-practice-and-summary | answer ABCD items with immediate feedback and see an end-of-set score summary | S-02 | FR-005, FR-006, FR-007, FR-009, US-01 | proposed |
| S-04 | open-ended-check-flow | submit open-ended answers and receive Check feedback within Check limits | S-03 | FR-017, FR-018, FR-019, US-01, US-03 | proposed |
| S-05 | stripe-pro-subscription | subscribe to PRO and operate under PRO fair-use generation and Check rules | S-01 | FR-013, FR-016, FR-020, FR-021, US-02 | blocked |
| S-06 | theme-preference-all-surfaces | switch light/dark on landing, blog, and practice; preference persists on the account | S-01 | FR-022, FR-023, US-04 | proposed |
| S-07 | delete-practice-data | delete a saved practice set or associated personal data | S-02 | FR-010 | proposed |
| S-08 | public-blog-and-seo | browse the blog index, read all launch post formats, use CTAs to practice, and be indexed via SEO basics | — | FR-024–FR-032, US-05 | ready |
| S-09 | practice-set-history | view and reopen past generated practice sets | S-03 | FR-008, US-01 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Platform & identity | `F-01` / `F-02` (parallel) → `F-03` → `S-01` | Speed bias: land server + data before AI spend; **F-01** and **F-02** can run in parallel agent sessions. |
| B | Core practice (north star path) | `S-01` → `S-02` → `S-03` → `S-04` | **S-02** is the north star; completes **US-01** with **S-03**–**S-04**. |
| C | Monetization | `S-01` → `S-05` | Joins Stream A at **S-01**; blocked on PRO pricing and subscription decisions. |
| D | Blog & SEO | `S-08` | Parallel public track — no auth prerequisite; can start while Stream A runs. |
| E | Account polish | `S-01` → `S-06`, `S-07`, `S-09` | **S-06** parallel with Stream B after **S-01**; **S-07** after **S-02**; **S-09** nice-to-have after **S-03**. |

## Baseline

What's already in place in the codebase as of `2026-05-26` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — Astro 6 + Tailwind v4 landing (`src/components/landing/`, `src/pages/index.astro`); React integrated, no `.tsx` islands; shadcn not installed (planned per `tech-stack.md`)
- **Backend / API:** partial — `@astrojs/vercel` in `astro.config.mjs`; no `src/pages/api/` or server route handlers
- **Data:** absent — no Supabase client, schema, or migrations in repo (planned per `tech-stack.md`)
- **Auth:** absent — no auth SDK, middleware, or session routes (planned: Supabase + Google OAuth)
- **Deploy / infra:** partial — Vercel adapter + `context/deployment/deploy-plan.md`; no `.github/workflows/` in repo
- **Observability:** absent — no app logging, error tracking, or analytics in code

## Foundations

### F-01: Server API foundation

- **Outcome:** (foundation) Astro server output on Vercel with a working pattern for server-only endpoints (AI, Stripe webhooks, auth callbacks).
- **Change ID:** server-api-foundation
- **PRD refs:** NFR (generation responsiveness), Access Control (signed-in practice requires server enforcement)
- **Unlocks:** F-03 (auth callbacks), S-02 (generation API), S-05 (Stripe webhook)
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Without server routes first, generation and billing cannot stay off the client — sequenced before any AI or payment slice.
- **Status:** ready

### F-02: Supabase data layer

- **Outcome:** (foundation) Postgres schema and data access for users, plan tier, monthly usage counters, practice sets, and theme preference.
- **Change ID:** supabase-data-schema
- **PRD refs:** NFR (data isolation), Access Control (per-user plan and quotas)
- **Unlocks:** F-03, S-01, S-06, S-07, S-09
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Usage metering and session persistence depend on schema shape — lock before auth and generation slices diverge.
- **Status:** ready

### F-03: Supabase OAuth auth

- **Outcome:** (foundation) Google OAuth sign-in, session issuance, and route protection for practice flows.
- **Change ID:** supabase-oauth-auth
- **PRD refs:** FR-001, Access Control
- **Unlocks:** S-01, all signed-in slices
- **Prerequisites:** F-01, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Auth touches every signed-in slice — deferring it blocks the entire practice stream.
- **Status:** proposed

## Slices

### S-01: Sign-in and usage dashboard

- **Outcome:** user can sign in via OAuth and see current plan (FREE default) with remaining generations and Check calls for the month.
- **Change ID:** sign-in-and-usage-dashboard
- **PRD refs:** FR-001, FR-012, US-02
- **Prerequisites:** F-01, F-02, F-03
- **Parallel with:** S-08 (after F-01/F-02 in progress)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Thin dashboard is enough for speed — avoids building practice UI before identity and quotas exist.
- **Status:** proposed

### S-02: JD-gated generation

- **Outcome:** user can paste a job description and optional CV text, request generation, and receive a ~20-question mixed set or a clear failure within plan limits.
- **Change ID:** jd-gated-generation
- **PRD refs:** FR-002, FR-003, FR-004, FR-014, FR-015, US-01
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - CV input for v1 — paste-only vs file upload (PDF/DOCX)? — Owner: product. Block: yes.
- **Risk:** North star slice — AI cost and latency land here; blocked until CV format decision avoids rework.
- **Status:** blocked

### S-03: ABCD practice and score summary

- **Outcome:** user can answer ABCD questions with immediate correct/incorrect and explanation, continue an in-progress set, and see a simple end-of-set score summary.
- **Change ID:** abcd-practice-and-summary
- **PRD refs:** FR-005, FR-006, FR-007, FR-009, US-01
- **Prerequisites:** S-02
- **Parallel with:** S-06 (after S-01)
- **Blockers:** —
- **Unknowns:**
  - How open-ended/Check results appear in the end-of-set summary — Owner: product. Block: no.
- **Risk:** Completes the fast feedback loop of **US-01** before Check complexity.
- **Status:** proposed

### S-04: Open-ended Check flow

- **Outcome:** user can submit free-text on open-ended items and receive critical Check feedback until monthly Check limits block further calls.
- **Change ID:** open-ended-check-flow
- **PRD refs:** FR-017, FR-018, FR-019, US-01, US-03
- **Prerequisites:** S-03
- **Parallel with:** S-05 (after S-01)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Check quality is a trust gate — depends on server-side AI from F-01 and honest JD/CV grounding rules.
- **Status:** proposed

### S-05: Stripe PRO subscription

- **Outcome:** user can subscribe to PRO via checkout and generate practice sets under PRO fair-use rules with visible usage and enforced caps.
- **Change ID:** stripe-pro-subscription
- **PRD refs:** FR-013, FR-016, FR-020, FR-021, US-02
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - PRO monthly price and annual billing later? — Owner: product. Block: yes.
  - Cancel/downgrade, failed payment, and grace-period rules? — Owner: product. Block: yes.
  - Exact UX when crossing 100 generations/month (warning vs silent daily cap)? — Owner: product. Block: no.
- **Risk:** Must-have for MVP per PRD but decision-heavy — sequenced after FREE path works to protect the 3-week timeline.
- **Status:** blocked

### S-06: Theme preference on all surfaces

- **Outcome:** user can switch light/dark on landing, blog, and signed-in practice; choice persists across sessions and devices when signed in.
- **Change ID:** theme-preference-all-surfaces
- **PRD refs:** FR-022, FR-023, US-04
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-08
- **Blockers:** —
- **Unknowns:**
  - Default theme on first visit (light, dark, or system)? — Owner: product. Block: no.
- **Risk:** Blog and landing need theme tokens early if shipped in parallel with **S-08**.
- **Status:** proposed

### S-07: Delete practice data

- **Outcome:** user can delete a saved practice set or associated personal data they no longer want stored.
- **Change ID:** delete-practice-data
- **PRD refs:** FR-010
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Minimum trust signal for sensitive JD/CV — small slice, safe to defer slightly after generation exists.
- **Status:** proposed

### S-08: Public blog and SEO

- **Outcome:** visitor can browse the blog index, read static quiz, open-ended, and interactive quiz posts without sign-in, follow CTAs to practice, and crawlers can discover posts via SEO metadata and sitemap.
- **Change ID:** public-blog-and-seo
- **PRD refs:** FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031, FR-032, US-05
- **Prerequisites:** —
- **Parallel with:** F-01, F-02, entire Stream B after landing layout exists
- **Blockers:** —
- **Unknowns:**
  - Interactive quiz — one reusable component vs per-post markup? — Owner: builder. Block: no.
  - Post URL scheme — flat `/blog/[slug]` vs hierarchy? — Owner: builder. Block: no.
  - JSON-LD structured data in v1 or fast-follow? — Owner: product. Block: no.
- **Risk:** Brownfield delta from shape notes — can ship on partial frontend without auth; compounds SEO while practice stream catches up.
- **Status:** ready

### S-09: Practice set history

- **Outcome:** user can view and reopen past generated practice sets from their account.
- **Change ID:** practice-set-history
- **PRD refs:** FR-008, US-01
- **Prerequisites:** S-03
- **Parallel with:** S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Nice-to-have in PRD — sequenced last on the practice stream to protect speed-to-launch.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | server-api-foundation | Enable Astro server routes on Vercel | yes | Run first or parallel with F-02 |
| F-02 | supabase-data-schema | Add Supabase schema for users, plans, and practice data | yes | Parallel with F-01 |
| F-03 | supabase-oauth-auth | Wire Google OAuth and protected practice routes | no | After F-01 + F-02 |
| S-01 | sign-in-and-usage-dashboard | Sign-in with usage dashboard (FREE plan) | no | After F-03 |
| S-02 | jd-gated-generation | JD paste + gated AI generation (~20 questions) | no | Blocked: CV input format (OQ 1) |
| S-03 | abcd-practice-and-summary | ABCD practice loop + score summary | no | After S-02 |
| S-04 | open-ended-check-flow | Open-ended answers + Check feedback | no | After S-03 |
| S-05 | stripe-pro-subscription | Stripe PRO checkout + fair-use limits | no | Blocked: PRO price + subscription lifecycle (OQ 2–3) |
| S-06 | theme-preference-all-surfaces | Light/dark theme across all surfaces | no | After S-01 |
| S-07 | delete-practice-data | Delete practice set / personal data | no | After S-02 |
| S-08 | public-blog-and-seo | Blog index, 3 post formats, SEO, CTA | yes | Parallel track — no auth dependency |
| S-09 | practice-set-history | Practice set history (nice-to-have) | no | After S-03 |

## Open Roadmap Questions

1. **CV upload format** — Paste-only vs file upload (PDF/DOCX parsing) for v1. Owner: product. Block: S-02.
2. **PRO price** — Monthly subscription amount and whether to offer annual billing later. Owner: product. Block: S-05.
3. **Subscription lifecycle** — Cancel/downgrade to FREE, failed payment, and grace-period rules before launch. Owner: product. Block: S-05.
4. **PRO soft-limit UX** — Exact copy and behavior when crossing 100 generations/month. Owner: product. Block: roadmap-wide (no).
5. **Score summary for open-ended** — How open-ended/Check results aggregate in end-of-set summary. Owner: product. Block: S-03 (no).
6. **MVP timeline vs scope** — Blog v1 plus core practice may exceed ~3 weeks after-hours; slip risk accepted 2026-05-26. Owner: builder. Block: roadmap-wide (no).
7. **Default theme on first visit** — Light, dark, or match OS before explicit choice. Owner: product. Block: S-06 (no).
8. **Interactive quiz format** — Single reusable quiz component vs per-post custom markup. Owner: builder. Block: S-08 (no).
9. **Structured data** — JSON-LD (Article, FAQ, Quiz) for rich search results — v1 or fast-follow. Owner: product. Block: S-08 (no).
10. **Analytics** — Privacy-friendly blog → sign-in funnel measurement (tool TBD). Owner: product. Block: roadmap-wide (no).
11. **Post URL scheme** — Flat `/blog/[slug]` vs topic hierarchy. Owner: builder. Block: S-08 (no).

## Parked

- **Regenerate same JD (FR-011)** — Why parked: nice-to-have; speed bias defers until core generate + complete path ships.
- **Practice set history as launch gate (FR-008 / S-09)** — Why parked: nice-to-have in PRD; slice remains sequenced but not on the must-have launch path.
- **In-app observability stack** — Why parked: no NFR gates launch on Sentry/metrics; Vercel platform logs suffice for MVP (`## Non-Goals` implicit in speed goal).
- **CI/CD workflows** — Why parked: absent in baseline; Vercel git deploy per `deploy-plan.md` is enough for solo MVP velocity.
- **Headless CMS, user-generated blog, blog AI Check, paywalled blog** — Why parked: PRD §Non-Goals.

## Done
