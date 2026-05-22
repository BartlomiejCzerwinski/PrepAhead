---
project: PrepAhead.dev
context_type: greenfield
created: 2026-05-21
updated: 2026-05-21
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: context_type
      decision: greenfield — new product from scratch
    - topic: pain_category
      decision: workflow friction + missing capability (no JD-to-practice loop)
    - topic: product_insight
      decision: role-specific prep must start from the actual job description, not generic banks
    - topic: primary_persona_scope
      decision: individual IT candidate, junior or mid-level, preparing for a specific role
    - topic: access_model
      decision: sign in with Google (Gmail) via Supabase Auth; flat user model, no roles in MVP
    - topic: mvp_flow
      decision: sign in → plan/usage visible → paste JD → optional CV → generate mixed set → MC feedback + open-ended Check → score summary; upgrade when at FREE limits
    - topic: mvp_timeline
      decision: fits ~3 weeks after-hours
    - topic: billing_in_mvp
      decision: Stripe + FREE/PRO plans in first shippable MVP
    - topic: usage_meter
      decision: practice-set generations per calendar month; regenerate counts as a generation
    - topic: plan_limits
      decision: FREE 1 generation/month; PRO fair-use generations (soft 100, daily 10 above soft, hard 300) + separate Check caps
    - topic: question_mix
      decision: ~15 ABCD + ~5 open-ended (architecture + behavioral) per practice set
    - topic: open_ended_feedback
      decision: Check button triggers critical AI feedback on free-text answers
    - topic: check_usage_meter
      decision: separate monthly Check caps — FREE 1, PRO 500
    - topic: pro_fair_use_generations
      decision: PRO soft 100/mo, up to 300/mo with max 10 generations/day, hard block at 300
    - topic: limit_behavior
      decision: block new generation at limit with upgrade to PRO via Stripe
    - topic: stripe_model
      decision: PRO = monthly subscription; FREE default for new users
  frs_drafted: 21
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# Shape notes — PrepAhead.dev

Seed idea (verbatim): AI-powered interview preparation — user pastes a job description and optionally CV/resume; app generates a personalized practice set. **Amended:** ~20 questions per set (~15 ABCD + ~5 open-ended architecture/behavioral); open-ended uses **Check** for critical AI feedback; FREE/PRO with Stripe; PRO generations on tiered fair-use (not unlimited). First version intentionally small; not a recruitment platform. Niche IT/software, junior and mid-level.

## Vision & Problem Statement

**Pain:** Job candidates preparing for tech interviews spend time on generic question lists and scattered resources that do not reflect the specific role they are applying for.

**Person:** Individual software engineer candidate at junior or mid level who has a target job posting in hand.

**Moment:** They are days or weeks before an interview for a particular role and need realistic, role-aligned practice—not another generic "top 50 interview questions" list.

**Cost today:** Prep is slow and fragmented: the job description and their background live in separate documents, practice material does not trace to the posting, and feedback loops are weak or absent. They cannot quickly turn "this JD + optionally my CV" into a focused practice session.

**Insight:** Generic interview-prep products optimize for breadth; PrepAhead optimizes for *this role* by anchoring generation on the actual job description (and optional candidate context), with honest limits on what the system can infer when CV is omitted.

## User & Persona

**Primary persona — "Role-focused IT candidate"**

- **Name (archetype):** Alex, junior or mid-level software engineer
- **Context:** Actively applying; has copied a job description from a company careers page or job board
- **Moment of need:** Wants a fast, practical drill before the interview—feels lightweight prep beats building a custom question list by hand
- **Success signal:** Completes a tailored practice set (MC + open-ended), gets immediate MC feedback and critical AI feedback on open-ended answers via Check, and understands gaps from the score summary

## Access Control

- **Model:** Authenticated user required for v1 — sign in with Google (Gmail) through Supabase Auth.
- **Roles:** Flat user model only; no admin/member/guest separation in MVP.
- **Plans:** Every signed-in user has a plan tier — **FREE** (default) or **PRO** (paid). Plan determines generation quota, not separate RBAC roles.
- **Implication:** Practice sessions and generated question sets are tied to a signed-in identity; plan and usage are evaluated before each new generation.

## Plans & usage

| Plan | Price (v1) | Practice-set generations / month | Open-ended **Check** calls / month | At limit |
|------|------------|----------------------------------|----------------------------------|----------|
| **FREE** | $0 | **1** | **1** | Block generation and Check; upgrade to PRO |
| **PRO** | Monthly subscription via Stripe (price TBD) | **Fair-use** (see below) | **500** | Block when hard cap hit; show usage |

### Practice-set composition

One generation produces **~20 questions**: **~15 ABCD (multiple-choice)** + **~5 open-ended** (mix of **architecture-like** and **behavioral**, grounded in the JD).

### Usage units

1. **Practice-set generation** — one successful create of the mixed question set from JD (+ optional CV). **Regenerate** (FR-011) counts as another generation.
2. **Check call** — one tap of **Check** on an open-ended answer to receive critical AI feedback on the candidate's free-text response. Capped separately from generations.

### PRO fair-use (generations only)

| Tier | Monthly generations | Daily generations | UX |
|------|---------------------|-------------------|-----|
| Normal | 1–100 | No daily cap | Standard usage display |
| Soft exceeded | 101–300 | **Max 10 / calendar day** | User may continue; daily cap enforced |
| Hard cap | **300 max** | — | **Block** new generations until next calendar month |

- **Soft limit (100/mo):** Threshold before daily cap applies — not a hard stop (exact warning copy TBD in implementation).
- **Hard limit (300/mo):** Absolute monthly maximum for PRO; block with message until monthly reset.

### Billing period

Calendar month — reset generation and Check counters per user each month.

### Payments

Integrated **Stripe** — PRO monthly subscription; FREE users upgrade when blocked or from plan UI.

## Forward: tech-stack

- User volunteered: Supabase Auth + Google provider for authentication. Downstream stack selection should treat this as a prior, not a PRD commitment.
- User volunteered: **Stripe** for PRO monthly subscription and payment integration. Downstream stack selection should treat this as a prior, not a PRD commitment.
- User volunteered: **critical AI model** for open-ended Check feedback (may differ from generation model). Downstream stack selection picks provider/model; PRD stays behavior-level only.

## Success Criteria

### Primary

Alex signs in with Google, sees plan (FREE or PRO) and remaining **generations** and **Check** calls for the month, pastes a job description (and optionally CV text), receives a generated set of ~20 questions (~15 ABCD + ~5 open-ended architecture/behavioral) grounded in that JD (within plan limits), completes the practice flow: for each ABCD question, immediate correct/incorrect plus short explanation; for each open-ended question, free-text answer and optional **Check** for critical AI feedback (within Check limits); at the end Alex sees a simple score summary (MC scored objectively; open-ended reflected as attempted/checked where applicable). If at monthly generation or Check limits, Alex is blocked from that action and can upgrade to PRO via Stripe when on FREE.

### Secondary

- Alex can revisit a past generated practice set from their account (history).

### Guardrails

- **Honest AI:** The app does not claim or use candidate facts that were not provided (JD + optional CV only).
- **JD-grounded:** Questions reflect the pasted job description, not generic IT trivia unrelated to the posting.
- **Privacy:** Job descriptions and CV content are treated as sensitive per-user data.
- **Tone:** Experience feels like role-specific interview preparation, not a generic school quiz — open-ended + Check models real interview depth, not only quiz drills.
- **Fair-use honesty:** PRO is marketed as generous usage, not infinite — limits are visible and enforced.
- **Perceived speed:** Lightweight, practical feel—visible progress during generation; avoid long silent waits without feedback.

## Functional Requirements

### Authentication

- FR-001: Candidate can sign in with Google. Priority: must-have
  > Socrates: Counter-argument: auth friction may kill validation before anyone pastes a JD. Resolution: kept — Google via Supabase is the lightest account path; identity supports history (FR-008) and per-user privacy for sensitive JD/CV.

### Job & profile input

- FR-002: Candidate can paste or enter a job description. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-003: Candidate can optionally paste or upload CV/resume content for personalization. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Question generation & practice

- FR-004: Candidate can generate a practice set of approximately twenty questions tailored to the pasted job description and optional CV — roughly fifteen ABCD (multiple-choice) plus roughly five open-ended questions (architecture-like and behavioral). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-005: Candidate can answer ABCD questions by selecting one option and open-ended questions by entering free-text. Priority: must-have
  > Socrates: Counter-argument: real tech interviews are mostly open-ended — MC alone may mis-train. Resolution: amended — mixed set (~15 MC + ~5 open-ended) balances fast loops with realistic depth.
- FR-006: Candidate sees whether each ABCD answer was correct and receives a short explanation immediately after answering. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-017: Candidate can tap Check on an open-ended answer to receive critical AI feedback on their free-text response. Priority: must-have
  > Socrates: Counter-argument: subjective AI grading may feel arbitrary or slow trust. Resolution: kept — framed as critical feedback, not a pass/fail grade; separate Check usage caps apply.
- FR-018: System blocks Check when the user has reached their monthly Check-call limit and shows remaining Check usage or upgrade path. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-007: Candidate sees a simple score summary after completing a practice set (objective counts for ABCD; open-ended shown as attempted and/or checked, not as a single pass/fail grade). Priority: must-have
  > Socrates: Counter-argument: MC score may imply interview readiness. Resolution: kept — label as practice drill score only; open-ended excluded from numeric "readiness" score; no readiness guarantees in copy.
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

- FR-012: Candidate can view their current plan (FREE or PRO), remaining practice-set generations, and remaining Check calls for the current calendar month. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-013: Candidate can subscribe to PRO via integrated Stripe monthly subscription checkout. Priority: must-have
  > Socrates: Counter-argument: Stripe in MVP may blow the 3-week timeline. Resolution: kept in MVP — user accepted timeline risk (see Timeline acknowledgment).
- FR-014: System blocks new practice-set generation when the user has reached their plan limit and presents an upgrade path to PRO. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-015: System increments the user's practice-set generation usage count when a generation completes successfully. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-019: System increments the user's Check-call usage count when a Check completes successfully. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-016: Candidate on PRO can generate practice sets under PRO fair-use rules (soft threshold 100/month, daily max 10 generations when above soft limit, hard stop at 300/month); the app displays generation and Check usage. Priority: must-have
  > Socrates: Counter-argument: tiered fair-use is complex to build and explain. Resolution: kept — user-specified caps; UX must surface soft/hard/daily limits clearly.
- FR-020: System enforces PRO daily generation cap (10 per calendar day) when monthly generation count is above the soft limit (100) and below the hard cap (300). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-021: System blocks new practice-set generation for PRO at 300 generations in the current calendar month until the next monthly reset. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## User Stories

### US-01: Generate and complete a role-specific practice set

- **Given** a signed-in candidate on PrepAhead.dev
- **When** they paste a job description, optionally add CV text, request question generation, and work through the full mixed set (~15 ABCD + ~5 open-ended)
- **Then** they receive immediate correct/incorrect plus explanation for each ABCD answer, can use Check on open-ended answers for critical AI feedback (within Check limits), and see a simple score summary at the end

#### Acceptance Criteria

- Generated questions are grounded in the pasted job description (not a generic IT-only bank disconnected from the posting)
- Set includes both ABCD and open-ended items; open-ended includes architecture-like and behavioral types
- When CV is omitted, the app does not reference specific candidate experience not provided
- When CV is provided, questions or explanations may reference only content present in JD and/or CV
- Practice set size is approximately twenty questions unless generation fails (user sees a clear error, not a silent partial set)
- FREE users with zero remaining generations cannot start a new generation until the next calendar month or PRO upgrade
- Successful generation increments monthly generation usage; regenerate counts as a separate generation
- Each successful Check increments monthly Check usage; blocked when Check limit reached

### US-02: Upgrade when FREE limit reached

- **Given** a signed-in FREE candidate who has used their one generation for the current calendar month
- **When** they attempt another practice-set generation
- **Then** generation is blocked, they see remaining usage (0) and a clear upgrade path to PRO via Stripe

#### Acceptance Criteria

- After successful Stripe subscription, plan shows PRO and generation is allowed under PRO fair-use rules; Check allowance increases to PRO tier
- Usage display updates after checkout completes (webhook or return URL — implementation detail deferred)

### US-03: Check an open-ended answer

- **Given** a signed-in candidate answering an open-ended question in an active practice set with remaining Check calls
- **When** they enter free-text and tap Check
- **Then** they receive critical AI feedback on their answer (strengths, gaps, suggestions) without a single "correct" MC key

#### Acceptance Criteria

- Check is unavailable when monthly Check limit is exhausted (FREE: 1, PRO: 500)
- Feedback does not invent candidate history beyond JD/CV provided
- One Check tap consumes one Check call from monthly allowance

## Business Logic

From a specific job description and optional CV text, PrepAhead derives role-relevant interview topics and generates a mixed practice set (ABCD + open-ended) grounded in that posting—refusing to invent candidate experience not present in the inputs—and gates generation and Check actions by plan limits (FREE vs PRO fair-use).

Supporting detail:

- **Inputs (user-facing):** Pasted job description; optional CV/resume text (paste or upload); current plan; remaining generations and Check calls.
- **Output:** ~20 questions (~15 ABCD with one correct option each; ~5 open-ended architecture/behavioral). ABCD: immediate correctness + explanation. Open-ended: free-text + optional **Check** → critical AI feedback (not a single official "correct" answer).
- **User encounter:** After sign-in, user sees plan/usage → supplies JD → optional CV → requests generation (blocked if at generation limit) → practices each question type → uses Check on open-ended items (blocked if at Check limit) → sees score summary.
- **Plan rules — generations:** FREE — 1 practice-set generation / month. PRO — fair-use: soft at 100/month, then daily max 10/day until hard cap 300/month, then block until reset.
- **Plan rules — Check calls:** FREE — 1 Check / month. PRO — 500 Checks / month.
- **Honesty constraint:** When CV is absent, personalization is limited to the JD; feedback must not fabricate employment history, projects, or skills.

## Non-Functional Requirements

- **Generation responsiveness:** For a typical-length pasted JD, the user sees visible progress during generation and receives a full practice set or a clear failure message within approximately sixty seconds under normal conditions.
- **Data isolation:** A user's job descriptions and CV content are not exposed to other users (binary commitment).
- **Practice UX tone:** Copy and question framing read as interview preparation for a specific role, not as a generic academic quiz.
- **Billing integrity:** Plan tier, generation counts, and Check counts reflect Stripe subscription state and successful usage only — limits cannot be bypassed without upgrading or monthly reset.
- **Check feedback quality:** Open-ended Check responses are critical and specific to the user's submitted text and the question context — not generic praise.

## Non-Goals

- **Custom payment stack:** No in-house billing, invoicing, or payment processing — Stripe handles PRO subscription in v1.

- **Recruitment platform:** No employer tooling, ATS, application tracking, or hiring-side workflows — candidate prep only.
- **Live mock interview mode:** No voice/video synchronous mock interviews or timed live interview simulation in v1 — async open-ended + Check only.
- **Multi-industry breadth:** Not optimizing for all industries before the IT junior/mid software wedge is validated.
- **Self-hosted / local LLM:** No on-prem or local-model inference stack in v1 — use managed AI APIs downstream of stack selection.

## Timeline acknowledgment

Acknowledged on 2026-05-21: MVP scope expanded to include Stripe + FREE/PRO usage metering; may exceed ~3 weeks after-hours despite original estimate; user accepted sustained-effort / timeline risk to ship monetization in v1.

Acknowledged on 2026-05-21: MVP scope further expanded — mixed ABCD + open-ended questions, Check with critical AI feedback, separate Check metering, PRO tiered fair-use (not unlimited); timeline risk accepted again.

## Quality cross-check

Re-checked after question-mix & fair-use amendment (2026-05-21): Access Control, Business Logic, Non-Goals, timeline acknowledgment present. Scope larger than MC-only MVP — open-ended Check and PRO tiered limits add build and UX surface.

## Open Questions

- **CV upload format:** Paste-only vs file upload (PDF/DOCX parsing) for v1 — affects MVP effort; resolve during stack selection / planning.
- **PRO price:** Monthly subscription amount (USD) and whether to show annual option later.
- **Stripe lifecycle:** Cancel/downgrade to FREE, failed payment, and grace period — product rules before implementation.
- **Study plans / weak-area scoring:** Explicitly deferred from v1; revisit after practice flow validation.
- **PRO soft-limit UX:** Exact copy and UI when crossing 100 generations/month (warning vs silent daily-cap enforcement).
- **Score summary for open-ended:** How open-ended/Check results aggregate in end-of-set summary (informational only vs weighted score).
