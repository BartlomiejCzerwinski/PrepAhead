---
project: PrepAhead.dev
version: 1
status: draft
created: 2026-05-22
updated: 2026-05-28
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Individual software engineer candidates at junior or mid level, days or weeks before an interview for a specific role, spend time on generic question lists and scattered resources that do not reflect that posting. Prep is slow and fragmented: the job description and their background live in separate documents, practice material does not trace to the posting, and feedback loops are weak or absent—they cannot quickly turn "this job description + optionally my CV" into a focused practice session.

Generic interview-prep products optimize for breadth; PrepAhead optimizes for *this role* by anchoring generation on the actual job description (and optional candidate context), with honest limits on what the product infers when a CV is omitted. The MVP adds mixed ABCD and open-ended practice, critical feedback on open-ended answers, FREE/PRO plans with visible usage limits, and a **public blog** on prepahead.dev—curated interview quizzes and question articles—to start **organic SEO** early on the owned domain instead of relying only on external channels. Core practice value remains behind sign-in; the blog gives indexable content for candidates searching for role- or skill-specific interview material before or alongside JD-based practice.

## User & Persona

**Primary persona — "Role-focused IT candidate" (Alex)**

- **Role:** Junior or mid-level software engineer actively applying
- **Context:** Has copied a job description from a careers page or job board
- **Moment of need:** Wants a fast, practical drill before the interview—lightweight prep beats building a custom question list by hand
- **Blog moment:** Finds PrepAhead via search for role- or skill-specific interview content (e.g., Java mid-level quiz), reads a post without signing in, and may later sign in for JD-tailored practice
- **Success signal:** Completes a tailored practice set (ABCD + open-ended), gets immediate ABCD feedback and critical feedback on open-ended answers via Check, and understands gaps from the score summary; or discovers the product through blog content and follows the CTA to practice

## Success Criteria

### Primary

- A signed-in candidate sees plan (FREE or PRO) and remaining **generations** and **Check** calls for the **current usage period**, pastes a job description (and optionally CV text), receives a generated set of ~20 questions (~15 ABCD + ~5 open-ended architecture/behavioral) grounded in that JD within plan limits, completes practice (ABCD: immediate correct/incorrect + explanation; open-ended: free-text + optional Check within Check limits), and sees a simple score summary at the end (ABCD scored objectively; open-ended reflected as attempted/checked where applicable).
- An anonymous visitor reaches a **blog index** on prepahead.dev listing published posts; opens at least one each of a **static quiz article**, an **open-ended question article**, and an **interactive quiz** (in-page answer selection + result summary); blog pages ship with **SEO basics** (unique titles, meta descriptions, clean URLs); and can follow a **CTA** from blog content to sign in and use JD-based practice.

### Secondary

- Candidate can revisit a past generated practice set from their account (history).
- At least **2–3 blog posts** live at launch beyond the index (mix of static quiz, open-ended, and interactive formats).

### Guardrails

- **Honest AI:** The product does not claim or use candidate facts that were not provided (JD + optional CV only).
- **JD-grounded:** Questions reflect the pasted job description, not generic IT trivia unrelated to the posting.
- **Privacy:** Job descriptions and CV content are treated as sensitive per-user data and are not exposed to other users; blog shows only editorial content—no user JD/CV or practice history on blog pages.
- **Tone:** Experience feels like role-specific interview preparation, not a generic school quiz—open-ended + Check models real interview depth.
- **Fair-use honesty:** PRO is positioned as generous usage, not infinite—limits are visible and enforced.
- **Perceived speed:** Lightweight, practical feel—visible progress during generation; avoid long silent waits without feedback; blog index and post pages feel snappy on mobile for typical post length (no multi-second blank screen before readable content).
- **Theme consistency:** Light and dark modes are readable and consistent across marketing pages, blog, and signed-in practice UI.
- **Honest blog scope:** Blog open-ended posts do not imply in-blog AI Check—that remains in the signed-in product unless explicitly added later.
- **Existing product preserved:** Sign-in, practice generation, Check, FREE/PRO billing, and landing CTAs continue to work when the blog ships.

## User Stories

### US-01: Generate and complete a role-specific practice set

- **Given** a signed-in candidate on PrepAhead.dev
- **When** they paste a job description, optionally add CV text, request question generation, and work through the full mixed set (~15 ABCD + ~5 open-ended)
- **Then** they receive immediate correct/incorrect plus explanation for each ABCD answer, can use Check on open-ended answers for critical feedback (within Check limits), and see a simple score summary at the end

#### Acceptance Criteria

- Generated questions are grounded in the pasted job description (not a generic IT-only bank disconnected from the posting)
- Set includes both ABCD and open-ended items; open-ended includes architecture-like and behavioral types
- When CV is omitted, the product does not reference specific candidate experience not provided
- When CV is provided, questions or explanations may reference only content present in JD and/or CV
- Practice set size is approximately twenty questions unless generation fails (user sees a clear error, not a silent partial set)
- FREE users with zero remaining generations cannot start a new generation until the next **usage period** resets or they upgrade to PRO
- Successful generation increments generation usage for the current usage period; regenerate counts as a separate generation
- Each successful Check increments Check usage for the current usage period; blocked when Check limit reached

### US-02: Upgrade when FREE limit reached

- **Given** a signed-in FREE candidate who has used their one generation for the current usage period
- **When** they attempt another practice-set generation
- **Then** generation is blocked, they see remaining usage (0) and a clear upgrade path to PRO

#### Acceptance Criteria

- After successful paid subscription, plan shows PRO and generation is allowed under PRO fair-use rules; Check allowance increases to PRO tier
- Usage display updates after the subscription becomes active

### US-03: Check an open-ended answer

- **Given** a signed-in candidate answering an open-ended question in an active practice set with remaining Check calls
- **When** they enter free-text and tap Check
- **Then** they receive critical feedback on their answer (strengths, gaps, suggestions) without a single "correct" ABCD key

#### Acceptance Criteria

- Check is unavailable when the usage-period Check limit is exhausted (FREE: 1, PRO: 500)
- Feedback does not invent candidate history beyond JD/CV provided
- One Check tap consumes one Check call from the current usage-period allowance

### US-04: Choose and keep a theme

- **Given** a signed-in candidate on any page of PrepAhead.dev
- **When** they switch between light and dark mode using the theme control
- **Then** the UI updates immediately and their choice is saved to their account for future sessions

#### Acceptance Criteria

- Theme applies to landing, blog, and signed-in practice screens—not practice-only
- Preference survives sign-out and sign-in on the same account
- Both themes keep text and interactive controls readable (no missing contrast on primary actions)

### US-05: Discover interview content and reach practice

- **Given** an anonymous visitor arriving from search or the site nav
- **When** they open the blog index, read a post (static quiz, open-ended, or interactive quiz), and choose the CTA to try role-specific practice
- **Then** they reach the existing sign-in / JD practice entry point without needing an account to read the post

#### Acceptance Criteria

- Blog index lists all v1 launch posts with readable titles and links
- Interactive quiz post allows answering all questions and shows a result summary without sign-in
- SEO metadata is present on index and post pages
- CTA is visible on blog posts and routes to the existing practice onboarding path
- No user JD/CV or practice-set data appears on blog pages

## Functional Requirements

### Authentication

- FR-001: Candidate can sign in via third-party OAuth (social sign-in). Priority: must-have
  > Socrates: Counter-argument: auth friction may kill validation before anyone pastes a JD. Resolution: kept — OAuth is the lightest account path; identity supports history (FR-008) and per-user privacy for sensitive JD/CV.

### Job & profile input

- FR-002: Candidate can paste or enter a job description. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-003: Candidate can optionally paste or upload CV/resume content for personalization. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Question generation & practice

- FR-004: Candidate can generate a practice set of approximately twenty questions tailored to the pasted job description and optional CV — roughly fifteen ABCD (multiple-choice) plus roughly five open-ended questions (architecture-like and behavioral). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-005: Candidate can answer ABCD questions by selecting one option and open-ended questions by entering free-text. Priority: must-have
  > Socrates: Counter-argument: real tech interviews are mostly open-ended — ABCD alone may mis-train. Resolution: amended — mixed set (~15 ABCD + ~5 open-ended) balances fast loops with realistic depth.
- FR-006: Candidate sees whether each ABCD answer was correct and receives a short explanation immediately after answering. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-017: Candidate can tap Check on an open-ended answer to receive critical feedback on their free-text response. Priority: must-have
  > Socrates: Counter-argument: subjective automated grading may feel arbitrary or erode trust. Resolution: kept — framed as critical feedback, not a pass/fail grade; separate Check usage caps apply.
- FR-018: System blocks Check when the user has reached their Check-call limit for the current usage period and shows remaining Check usage or upgrade path. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-007: Candidate sees a simple score summary after completing a practice set (objective counts for ABCD; open-ended shown as attempted and/or checked, not as a single pass/fail grade). Priority: must-have
  > Socrates: Counter-argument: ABCD score may imply interview readiness. Resolution: kept — label as practice drill score only; open-ended excluded from numeric "readiness" score; no readiness guarantees in copy.
- FR-011: Candidate can regenerate a new question set for the same job description (and optional CV). Priority: nice-to-have
  > Socrates: No counter-argument; it stands as written.

### Session continuity, history & data

- FR-008: Candidate can view and open past practice sets from their account. Priority: nice-to-have
  > Socrates: No counter-argument; it stands as written.
- FR-009: Candidate can continue an in-progress practice set without losing answers already submitted. Priority: must-have
  > Socrates: Counter-argument: session state adds engineering time. Resolution: kept in minimal form — persist current question index and submitted answers only; no branching flows or timers in v1.
- FR-010: Candidate can delete a saved practice set or associated personal data they no longer want stored. Priority: must-have
  > Socrates: Counter-argument: formal delete may be overkill pre-traction. Resolution: kept — JD/CV are sensitive; delete-one-set is minimum trust signal even for early users.

### Plans, usage & billing

- FR-012: Candidate can view their current plan (FREE or PRO), remaining practice-set generations, and remaining Check calls for the **current usage period**, including when the period resets. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-013: Candidate can subscribe to PRO via integrated monthly subscription checkout. Priority: must-have
  > Socrates: Counter-argument: paid checkout in MVP may blow the 3-week timeline. Resolution: kept in MVP — user accepted timeline risk (see Open Questions / timeline acknowledgment in shape input).
- FR-014: System blocks new practice-set generation when the user has reached their plan limit and presents an upgrade path to PRO. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-015: System increments the user's practice-set generation usage count when a generation completes successfully. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-019: System increments the user's Check-call usage count when a Check completes successfully. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-016: Candidate on PRO can generate practice sets under PRO fair-use rules (soft threshold 100 generations per usage period, daily max 10 generations per **calendar day** when above soft limit, hard stop at 300 per usage period); the app displays generation and Check usage. Priority: must-have
  > Socrates: Counter-argument: tiered fair-use is complex to build and explain. Resolution: kept — user-specified caps; UX must surface soft/hard/daily limits clearly.
- FR-020: System enforces PRO daily generation cap (10 per **calendar day**, UTC) when usage-period generation count is above the soft limit (100) and below the hard cap (300). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-021: System blocks new practice-set generation for PRO at 300 generations in the current usage period until the next usage-period reset. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Appearance & preferences

- FR-022: Candidate can switch between light mode and dark mode using an in-app control. Priority: must-have
  > Socrates: Counter-argument: theme work delays core practice flow. Resolution: kept in MVP — user requires it across all surfaces; aligns with component library theming.
- FR-023: System persists the signed-in candidate's theme preference and restores it on subsequent visits and devices when they sign in again. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Blog discovery & reading

- FR-024: Visitor can view a blog index listing published posts. Priority: must-have
  > Socrates: Counter-argument: empty or stale index hurts credibility before enough posts exist. Resolution: kept — launch criterion requires 2–3 posts live; do not ship an empty index.
- FR-025: Visitor can read a full blog post without signing in. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Blog content formats

- FR-026: Visitor can read a static quiz article (interview questions with answers provided in the post content). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-027: Visitor can read an open-ended interview-question article. Priority: must-have
  > Socrates: Counter-argument: without Check/AI feedback, open-ended posts feel shallow vs the app. Resolution: kept — blog educates and ranks; critical feedback remains in signed-in practice; guardrail in Success Criteria.
- FR-028: Visitor can complete an interactive quiz on a blog post (select answers and see a result summary). Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Blog SEO & funnel

- FR-029: Each published blog post exposes indexable SEO metadata (title, description, canonical URL). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-030: Site exposes a sitemap (or equivalent discoverable URL list) that includes blog post URLs. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-031: Visitor can follow a call-to-action from blog content to the sign-in / JD practice flow. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Blog authoring

- FR-032: Founder can add and publish blog posts by adding content to the repository (static/markdown). Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## Non-Functional Requirements

- **Generation responsiveness:** For a typical-length pasted JD, the user sees visible progress during generation and receives a full practice set or a clear failure message within approximately sixty seconds under normal conditions.
- **Data isolation:** A user's job descriptions and CV content are not exposed to other users (binary commitment).
- **Practice UX tone:** Copy and question framing read as interview preparation for a specific role, not as a generic academic quiz.
- **Billing integrity:** Plan tier, generation counts, and Check counts reflect active paid subscription state and successful usage only — limits cannot be bypassed without upgrading or usage-period reset.
- **Check feedback quality:** Open-ended Check responses are critical and specific to the user's submitted text and the question context — not generic praise.
- **Theme readability:** In both light and dark modes, primary text and controls meet a readable contrast bar for normal use (binary: no unreadable primary actions in either mode).
- **Blog read performance:** Blog index and post pages feel snappy on mobile for typical post length (binary: no multi-second blank screen before readable content).
- **SEO-friendly markup:** Post content and headings are available in server-rendered HTML suitable for crawlers (not JS-only article bodies).

## Business Logic

From a specific job description and optional CV text, PrepAhead derives role-relevant interview topics and generates a mixed practice set (ABCD + open-ended) grounded in that posting—refusing to invent candidate experience not present in the inputs—and gates generation and Check actions by plan limits (FREE vs PRO fair-use). Separately, PrepAhead publishes **curated, skill- and level-tagged interview content** structured for **search discovery**, with optional **in-post interactive scoring** on quiz posts—**personalization from the visitor's JD remains in the signed-in app**, not on the blog.

Supporting detail:

- **Practice inputs (user-facing):** Pasted job description; optional CV/resume text (paste or upload); current plan; remaining generations and Check calls.
- **Practice output:** ~20 questions (~15 ABCD with one correct option each; ~5 open-ended architecture/behavioral). ABCD: immediate correctness + explanation. Open-ended: free-text + optional **Check** → critical feedback (not a single official "correct" answer).
- **Blog inputs (user-facing):** Editorial post content; visitor selections on interactive quiz posts.
- **Blog output:** Readable articles (static quiz, open-ended lists, interactive quiz with result summary); indexable pages with metadata; CTA path to sign-in.
- **User encounter (practice):** After sign-in, user sees plan/usage → supplies JD → optional CV → requests generation (blocked if at generation limit) → practices each question type → uses Check on open-ended items (blocked if at Check limit) → sees score summary.
- **User encounter (blog):** Search or nav → blog index → post → (optional quiz interaction) → CTA → existing practice flow.
- **Plan rules — generations:** FREE — 1 practice-set generation / usage period. PRO — fair-use: soft at 100 per usage period, then daily max 10 per **calendar day** (UTC) until hard cap 300 per usage period, then block until the next usage-period reset.
- **Plan rules — Check calls:** FREE — 5 Checks / usage period (S-04: matches the 5 open-ended questions per generated set). PRO — 500 Checks / usage period.
- **Practice-set composition:** One generation produces ~20 questions (~15 ABCD + ~5 open-ended architecture/behavioral). Regenerate counts as another generation.
- **Honesty constraint:** When CV is absent, personalization is limited to the JD; feedback must not fabricate employment history, projects, or skills.
- **Blog boundary:** Blog does not consume or display user JD/CV; does not run Check or plan-metered AI on blog pages in v1.

## Access Control

- **Authentication:** Signed-in user required for practice flows — third-party OAuth (social sign-in).
- **Roles:** Flat user model only; no admin/member/guest separation in MVP.
- **Plans:** Every signed-in user has a plan tier — **FREE** (default) or **PRO** (paid). Plan determines generation and Check quotas, not separate RBAC roles.
- **Usage period (metering):** Generation and Check quotas use a **rolling usage period** per account, anchored at account creation (same day/time each cycle, **UTC** — e.g. user who joins 15 May resets 15 Jun). This is **not** a shared calendar month (1st–last). The dashboard shows remaining allowance for the current period and the next reset time. **PRO daily cap (FR-020)** uses **calendar day** (UTC), separate from the rolling period boundary.
- **FREE limits:** 1 practice-set generation and 5 Check calls per usage period; block at limit with upgrade path to PRO.
- **PRO limits:** Generations under fair-use (1–100 per usage period normal; 101–300 per usage period with max 10 generations per calendar day; hard block at 300 per usage period). 500 Check calls per usage period. Generation and Check counters reset at each usage-period boundary.
- **Blog read access:** All blog posts are **public** — anonymous visitors and search crawlers can read full content without signing in.
- **Blog authoring (v1):** **Founder-authored static content** deployed with the site; no new author roles, no signed-in candidate publishing.
- **Implication:** Practice sessions and generated question sets are tied to a signed-in identity; plan and usage are evaluated before each generation and each Check.

## Non-Goals

- **Custom payment stack:** No in-house billing, invoicing, or payment processing in v1 — subscription handled by an external payment provider.
- **Recruitment platform:** No employer tooling, ATS, application tracking, or hiring-side workflows — candidate prep only.
- **Live mock interview mode:** No voice/video synchronous mock interviews or timed live interview simulation in v1 — async open-ended + Check only.
- **Multi-industry breadth:** Not optimizing for all industries before the IT junior/mid software wedge is validated.
- **Self-hosted inference:** No on-prem or locally hosted model inference in v1.
- **Study plans / weak-area scoring:** Deferred from v1; revisit after practice flow validation.
- **Custom themes beyond light/dark:** No user-defined color palettes, accent pickers, or branded employer themes in v1 — only light and dark.
- **User-generated blog content:** No candidate-authored posts, comments, or forums in v1.
- **Headless CMS / heavy editorial stack:** No CMS integration or complex publish workflow in v1 — repo-based static posts only.
- **Blog AI Check:** No Check-style AI grading on blog open-ended content in v1.
- **Paywalled blog:** All launch posts remain free to read.
- **Multi-language blog:** English-only (or single-locale) content in v1.
- **Rewrite core app for blog:** No redesign of auth, practice flow, or billing driven by blog work.

## Open Questions

1. **CV upload format** — Paste-only vs file upload (PDF/DOCX parsing) for v1. Owner: product. Affects MVP effort; resolve during stack selection / planning.
2. **PRO price** — Monthly subscription amount and whether to offer annual billing later. Owner: product.
3. **Subscription lifecycle** — Cancel/downgrade to FREE, failed payment, and grace-period rules before launch. Owner: product.
4. **PRO soft-limit UX** — Exact copy and behavior when crossing 100 generations per usage period (warning vs silent daily-cap enforcement). Owner: product.
5. **Score summary for open-ended** — How open-ended/Check results aggregate in end-of-set summary (informational only vs weighted score). Owner: product. **Resolved 2026-06-26 (S-04):** informational only — summary shows `attempted / 5` and `checked / 5` counts, no numeric grade or weighting.
6. **MVP timeline vs scope** — Blog v1 (static quiz, open-ended articles, interactive quiz, SEO basics, CTA) plus core practice scope may exceed ~3 weeks after-hours; sustained-effort / slip risk was accepted on 2026-05-26. Owner: builder.
7. **Default theme on first visit** — Light by default, dark by default, or match OS preference before the user makes an explicit choice. Owner: product. Resolve during implementation.
8. **Interactive quiz format** — Single reusable quiz component vs per-post custom markup? Resolve during implementation planning.
9. **Structured data** — Structured markup (Article, FAQ, Quiz) for rich search results — include in v1 or fast-follow?
10. **Analytics** — Privacy-friendly traffic measurement for blog → sign-in funnel (tool choice deferred).
11. **Post URL scheme** — Flat `/blog/[slug]` vs topic hierarchy — resolve during implementation.
12. **FREE Check allowance** — **Changed 2026-06-26 (S-04):** FREE Check calls raised from 1 → 5 per usage period so a FREE user can Check all 5 open-ended questions in a set (full-set completion requires all 5 Checked). Earlier shape notes / Business Logic stated 1; this is the authoritative value. Owner: product.
