---
project: PrepAhead.dev
version: 1
status: draft
created: 2026-05-22
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

Generic interview-prep products optimize for breadth; PrepAhead optimizes for *this role* by anchoring generation on the actual job description (and optional candidate context), with honest limits on what the product infers when a CV is omitted. The MVP adds mixed ABCD and open-ended practice, critical feedback on open-ended answers, and FREE/PRO plans with visible usage limits.

## User & Persona

**Primary persona — "Role-focused IT candidate" (Alex)**

- **Role:** Junior or mid-level software engineer actively applying
- **Context:** Has copied a job description from a careers page or job board
- **Moment of need:** Wants a fast, practical drill before the interview—lightweight prep beats building a custom question list by hand
- **Success signal:** Completes a tailored practice set (ABCD + open-ended), gets immediate ABCD feedback and critical feedback on open-ended answers via Check, and understands gaps from the score summary

## Success Criteria

### Primary

- A signed-in candidate sees plan (FREE or PRO) and remaining **generations** and **Check** calls for the month, pastes a job description (and optionally CV text), receives a generated set of ~20 questions (~15 ABCD + ~5 open-ended architecture/behavioral) grounded in that JD within plan limits, completes practice (ABCD: immediate correct/incorrect + explanation; open-ended: free-text + optional Check within Check limits), and sees a simple score summary at the end (ABCD scored objectively; open-ended reflected as attempted/checked where applicable).
- When at monthly generation or Check limits, the candidate is blocked from that action; FREE users can upgrade to PRO.

### Secondary

- Candidate can revisit a past generated practice set from their account (history).

### Guardrails

- **Honest AI:** The product does not claim or use candidate facts that were not provided (JD + optional CV only).
- **JD-grounded:** Questions reflect the pasted job description, not generic IT trivia unrelated to the posting.
- **Privacy:** Job descriptions and CV content are treated as sensitive per-user data and are not exposed to other users.
- **Tone:** Experience feels like role-specific interview preparation, not a generic school quiz—open-ended + Check models real interview depth.
- **Fair-use honesty:** PRO is positioned as generous usage, not infinite—limits are visible and enforced.
- **Perceived speed:** Lightweight, practical feel—visible progress during generation; avoid long silent waits without feedback.
- **Theme consistency:** Light and dark modes are readable and consistent across marketing pages, content, and signed-in practice UI.

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
- FREE users with zero remaining generations cannot start a new generation until the next calendar month or PRO upgrade
- Successful generation increments monthly generation usage; regenerate counts as a separate generation
- Each successful Check increments monthly Check usage; blocked when Check limit reached

### US-02: Upgrade when FREE limit reached

- **Given** a signed-in FREE candidate who has used their one generation for the current calendar month
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

- Check is unavailable when monthly Check limit is exhausted (FREE: 1, PRO: 500)
- Feedback does not invent candidate history beyond JD/CV provided
- One Check tap consumes one Check call from monthly allowance

### US-04: Choose and keep a theme

- **Given** a signed-in candidate on any page of PrepAhead.dev
- **When** they switch between light and dark mode using the theme control
- **Then** the UI updates immediately and their choice is saved to their account for future sessions

#### Acceptance Criteria

- Theme applies to landing, content/blog pages, and signed-in practice screens—not practice-only
- Preference survives sign-out and sign-in on the same account
- Both themes keep text and interactive controls readable (no missing contrast on primary actions)

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
- FR-018: System blocks Check when the user has reached their monthly Check-call limit and shows remaining Check usage or upgrade path. Priority: must-have
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

- FR-012: Candidate can view their current plan (FREE or PRO), remaining practice-set generations, and remaining Check calls for the current calendar month. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-013: Candidate can subscribe to PRO via integrated monthly subscription checkout. Priority: must-have
  > Socrates: Counter-argument: paid checkout in MVP may blow the 3-week timeline. Resolution: kept in MVP — user accepted timeline risk (see Open Questions / timeline acknowledgment in shape input).
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

### Appearance & preferences

- FR-022: Candidate can switch between light mode and dark mode using an in-app control. Priority: must-have
  > Socrates: Counter-argument: theme work delays core practice flow. Resolution: kept in MVP — user requires it across all surfaces; aligns with component library theming.
- FR-023: System persists the signed-in candidate's theme preference and restores it on subsequent visits and devices when they sign in again. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## Non-Functional Requirements

- **Generation responsiveness:** For a typical-length pasted JD, the user sees visible progress during generation and receives a full practice set or a clear failure message within approximately sixty seconds under normal conditions.
- **Data isolation:** A user's job descriptions and CV content are not exposed to other users (binary commitment).
- **Practice UX tone:** Copy and question framing read as interview preparation for a specific role, not as a generic academic quiz.
- **Billing integrity:** Plan tier, generation counts, and Check counts reflect active paid subscription state and successful usage only — limits cannot be bypassed without upgrading or monthly reset.
- **Check feedback quality:** Open-ended Check responses are critical and specific to the user's submitted text and the question context — not generic praise.
- **Theme readability:** In both light and dark modes, primary text and controls meet a readable contrast bar for normal use (binary: no unreadable primary actions in either mode).

## Business Logic

From a specific job description and optional CV text, PrepAhead derives role-relevant interview topics and generates a mixed practice set (ABCD + open-ended) grounded in that posting—refusing to invent candidate experience not present in the inputs—and gates generation and Check actions by plan limits (FREE vs PRO fair-use).

Supporting detail:

- **Inputs (user-facing):** Pasted job description; optional CV/resume text (paste or upload); current plan; remaining generations and Check calls.
- **Output:** ~20 questions (~15 ABCD with one correct option each; ~5 open-ended architecture/behavioral). ABCD: immediate correctness + explanation. Open-ended: free-text + optional **Check** → critical feedback (not a single official "correct" answer).
- **User encounter:** After sign-in, user sees plan/usage → supplies JD → optional CV → requests generation (blocked if at generation limit) → practices each question type → uses Check on open-ended items (blocked if at Check limit) → sees score summary.
- **Plan rules — generations:** FREE — 1 practice-set generation / calendar month. PRO — fair-use: soft at 100/month, then daily max 10/day until hard cap 300/month, then block until reset.
- **Plan rules — Check calls:** FREE — 1 Check / calendar month. PRO — 500 Checks / calendar month.
- **Practice-set composition:** One generation produces ~20 questions (~15 ABCD + ~5 open-ended architecture/behavioral). Regenerate counts as another generation.
- **Honesty constraint:** When CV is absent, personalization is limited to the JD; feedback must not fabricate employment history, projects, or skills.

## Access Control

- **Authentication:** Signed-in user required for v1 — third-party OAuth (social sign-in).
- **Roles:** Flat user model only; no admin/member/guest separation in MVP.
- **Plans:** Every signed-in user has a plan tier — **FREE** (default) or **PRO** (paid). Plan determines generation and Check quotas, not separate RBAC roles.
- **FREE limits:** 1 practice-set generation and 1 Check call per calendar month; block at limit with upgrade path to PRO.
- **PRO limits:** Generations under fair-use (1–100/month normal; 101–300/month with max 10 generations per calendar day; hard block at 300/month). 500 Check calls per calendar month. Usage counters reset each calendar month.
- **Implication:** Practice sessions and generated question sets are tied to a signed-in identity; plan and usage are evaluated before each generation and each Check.

## Non-Goals

- **Custom payment stack:** No in-house billing, invoicing, or payment processing in v1 — subscription handled by an external payment provider.
- **Recruitment platform:** No employer tooling, ATS, application tracking, or hiring-side workflows — candidate prep only.
- **Live mock interview mode:** No voice/video synchronous mock interviews or timed live interview simulation in v1 — async open-ended + Check only.
- **Multi-industry breadth:** Not optimizing for all industries before the IT junior/mid software wedge is validated.
- **Self-hosted inference:** No on-prem or locally hosted model inference in v1.
- **Study plans / weak-area scoring:** Deferred from v1; revisit after practice flow validation.
- **Custom themes beyond light/dark:** No user-defined color palettes, accent pickers, or branded employer themes in v1 — only light and dark.

## Open Questions

1. **CV upload format** — Paste-only vs file upload (PDF/DOCX parsing) for v1. Owner: product. Affects MVP effort; resolve during stack selection / planning.
2. **PRO price** — Monthly subscription amount and whether to offer annual billing later. Owner: product.
3. **Subscription lifecycle** — Cancel/downgrade to FREE, failed payment, and grace-period rules before launch. Owner: product.
4. **PRO soft-limit UX** — Exact copy and behavior when crossing 100 generations/month (warning vs silent daily-cap enforcement). Owner: product.
5. **Score summary for open-ended** — How open-ended/Check results aggregate in end-of-set summary (informational only vs weighted score). Owner: product.
6. **MVP timeline vs scope** — Shape input acknowledges billing, mixed question types, and fair-use may exceed ~3 weeks after-hours; confirm sustained-effort commitment or scope trade-offs. Owner: builder.
7. **Default theme on first visit** — Light by default, dark by default, or match OS preference before the user makes an explicit choice. Owner: product. Resolve during implementation.
