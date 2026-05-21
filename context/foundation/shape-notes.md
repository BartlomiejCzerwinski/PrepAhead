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
      decision: sign in → paste JD → optional CV → generate ~20 MC Qs → practice with feedback → score summary
    - topic: mvp_timeline
      decision: fits ~3 weeks after-hours
  frs_drafted: 11
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

Seed idea (verbatim): AI-powered interview preparation — user pastes a job description and optionally CV/resume; app generates a personalized practice set (~20 MC questions with feedback). First version intentionally small; not a recruitment platform. Niche IT/software, junior and mid-level. Positioning options: "Paste a job description. Get a personalized interview prep set." / "Prepare for your next tech interview based on the role you are actually applying for."

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
- **Success signal:** Completes a tailored multiple-choice practice set and understands gaps via immediate correct/incorrect feedback and short explanations

## Access Control

- **Model:** Authenticated user required for v1 — sign in with Google (Gmail) through Supabase Auth.
- **Roles:** Flat user model only; no admin/member/guest separation in MVP.
- **Implication:** Practice sessions and generated question sets are tied to a signed-in identity (enables history/revisit later; not in scope unless added in MVP flow).

## Forward: tech-stack

- User volunteered: Supabase Auth + Google provider for authentication. Downstream stack selection should treat this as a prior, not a PRD commitment.

## Success Criteria

### Primary

Alex signs in with Google, pastes a job description (and optionally CV text), receives a generated set of ~20 multiple-choice questions grounded in that JD, completes the practice flow, and for each question sees whether the answer was correct plus a short explanation; at the end Alex sees a simple score summary (e.g. correct count / total).

### Secondary

- Alex can revisit a past generated practice set from their account (history).

### Guardrails

- **Honest AI:** The app does not claim or use candidate facts that were not provided (JD + optional CV only).
- **JD-grounded:** Questions reflect the pasted job description, not generic IT trivia unrelated to the posting.
- **Privacy:** Job descriptions and CV content are treated as sensitive per-user data.
- **Tone:** Experience feels like role-specific interview preparation, not a generic school quiz.
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

- FR-004: Candidate can generate a practice set of approximately twenty multiple-choice questions tailored to the pasted job description and optional CV. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-005: Candidate can answer each question in a multiple-choice format. Priority: must-have
  > Socrates: Counter-argument: real tech interviews are mostly open-ended — MC may mis-train. Resolution: kept for v1 — fast, objective feedback loop for validation; open-ended/mock modes explicitly deferred (see Non-Goals).
- FR-006: Candidate sees whether each answer was correct and receives a short explanation after answering. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-007: Candidate sees a simple score summary after completing a practice set. Priority: must-have
  > Socrates: Counter-argument: MC score may imply interview readiness. Resolution: kept — label as practice drill score only; no readiness guarantees in copy.
- FR-011: Candidate can regenerate a new question set for the same job description (and optional CV). Priority: nice-to-have
  > Socrates: No counter-argument; it stands as written.

### Session continuity, history & data

- FR-008: Candidate can view and open past practice sets from their account. Priority: nice-to-have
  > Socrates: No counter-argument; it stands as written.
- FR-009: Candidate can continue an in-progress practice set without losing answers already submitted. Priority: must-have
  > Socrates: Counter-argument: session state adds engineering time. Resolution: kept in minimal form — persist current question index and submitted answers only; no branching flows or timers in v1.
- FR-010: Candidate can delete a saved practice set or associated personal data they no longer want stored. Priority: must-have
  > Socrates: Counter-argument: formal delete may be overkill pre-traction. Resolution: kept — JD/CV are sensitive; delete-one-set is minimum trust signal even for early users.

## User Stories

### US-01: Generate and complete a role-specific practice set

- **Given** a signed-in candidate on PrepAhead.dev
- **When** they paste a job description, optionally add CV text, request question generation, and complete all multiple-choice questions in the set
- **Then** they receive per-question correct/incorrect feedback with short explanations and a simple score summary at the end

#### Acceptance Criteria

- Generated questions are grounded in the pasted job description (not a generic IT-only bank disconnected from the posting)
- When CV is omitted, the app does not reference specific candidate experience not provided
- When CV is provided, questions or explanations may reference only content present in JD and/or CV
- Practice set size is approximately twenty questions unless generation fails (user sees a clear error, not a silent partial set)

## Business Logic

From a specific job description and optional CV text, PrepAhead derives role-relevant interview topics and generates a multiple-choice practice set grounded in that posting—refusing to invent candidate experience not present in the inputs.

Supporting detail:

- **Inputs (user-facing):** Pasted job description; optional CV/resume text (paste or upload).
- **Output:** ~20 multiple-choice questions with one correct answer per question, plus post-answer explanations tied to the question.
- **User encounter:** After sign-in, user supplies JD → optional CV → requests generation → practices question-by-question → sees score summary.
- **Honesty constraint:** When CV is absent, personalization is limited to the JD; the system must not fabricate employment history, projects, or skills.

## Non-Functional Requirements

- **Generation responsiveness:** For a typical-length pasted JD, the user sees visible progress during generation and receives a full practice set or a clear failure message within approximately sixty seconds under normal conditions.
- **Data isolation:** A user's job descriptions and CV content are not exposed to other users (binary commitment).
- **Practice UX tone:** Copy and question framing read as interview preparation for a specific role, not as a generic academic quiz.

## Non-Goals

- **Recruitment platform:** No employer tooling, ATS, application tracking, or hiring-side workflows — candidate prep only.
- **Open-ended / mock interview mode:** No voice/video mock interviews or free-text answer grading in v1.
- **Multi-industry breadth:** Not optimizing for all industries before the IT junior/mid software wedge is validated.
- **Self-hosted / local LLM:** No on-prem or local-model inference stack in v1 — use managed AI APIs downstream of stack selection.

## Quality cross-check

All elements present at close — no override warnings.

## Open Questions

- **CV upload format:** Paste-only vs file upload (PDF/DOCX parsing) for v1 — affects MVP effort; resolve during stack selection / planning.
- **Generation limits:** Rate limits or daily caps per user for AI cost control — product decision before public launch.
- **Study plans / weak-area scoring:** Explicitly deferred from v1; revisit after MC flow validation.
