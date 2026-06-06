# JD-gated generation — Plan Brief

> Full plan: `context/changes/jd-gated-generation/plan.md`
> Roadmap: `context/foundation/roadmap.md` (S-02)
> PRD: `context/foundation/prd.md` (FR-002, FR-003, FR-004, FR-014, FR-015, US-01)

## What & Why

`jd-gated-generation` is the north-star slice of PrepAhead: a signed-in user should be able to paste a job description, optionally upload a PDF CV, request generation, and receive a role-specific practice set within quota limits. This is the first slice that proves the product is more than a usage dashboard or auth shell, so the plan protects the core promise over UI polish.

## Starting Point

The foundations are already shipped: `/app` auth gating, the usage dashboard, `practice_sets`, and the generation-usage RPC all exist. What is missing is the actual generation flow: there is no `/app/generate`, no upload/parse path, no model call, no exact question-set validator, and no route that shows a generated set.

## Desired End State

After this plan, a signed-in user can open `/app/generate`, paste a JD, optionally upload a PDF CV that is parsed into internal resume text, and submit one generation request at a time. The app shows staged progress, keeps the request recoverable if the user leaves, and lands on a generated-set overview only after a valid exact 20-question set has been saved and metered correctly.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| CV input | PDF upload parsed into hidden `resumeText` | Matches the product choice made during planning while keeping the form simpler than upload-plus-edit. |
| App location | Dedicated `/app/generate` route | Keeps the dashboard clean and gives S-02 room to grow without crowding `/app`. |
| Success destination | Generated-set overview page | Proves the slice worked without pulling S-03's answer loop forward. |
| Set contract | Exact 20 questions | The user preferred a strict outcome over a fuzzy "~20" promise. |
| Invalid output handling | Fail cleanly and do not charge | Protects quota integrity and avoids storing partial/low-trust sets. |
| Loading UX | Staged progress screen | Long-running generation needs clearer feedback than a spinner. |
| Duplicate submit behavior | Disable repeat submission while running | Prevents accidental double usage and duplicate set creation. |
| No-CV behavior | Optional field with lightweight helper copy only | Keeps the form simple while still signaling that CV upload is optional. |
| Leave-page behavior | Warn when possible, keep generation running, recover later | Preserves user effort without requiring them to babysit the request. |
| Cut line | Trim progress polish before core flow | Protects the north-star value if implementation pressure appears. |

## Scope

**In scope:** `/app/generate`; React generation form; optional PDF parse endpoint; generation endpoint; exact-20 validation; generation lifecycle persistence; staged loading and recovery; generated-set overview; quota increment only on success.

**Out of scope:** DOCX/OCR; editable parsed CV text; full answer loop and score summary; Check flow; full practice-set history; regenerate UX; billing/pro daily-cap work.

## Architecture / Approach

An Astro page at `/app/generate` loads signed-in context and hydrates a React island for upload and loading states. Server endpoints handle PDF parsing and final generation, while Supabase stores one user-owned `practice_sets` row plus generation lifecycle state so the client can recover after leaving the loading screen. A read-only `/app/sets/[id]` page becomes the success destination.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Generation entry flow | Dedicated route, JD form, PDF upload UX, dashboard CTA | First interactive signed-in island in the app |
| 2. Server generation pipeline | PDF parsing, provider call, exact-20 validation, persistence, metering | Provider output may not reliably satisfy the strict contract |
| 3. Loading, recovery, and overview | Staged progress, leave-page recovery, generated-set overview | Recovery can sprawl into history-like scope if not kept tight |
| 4. Verification and hygiene | Manual smoke coverage and verification log | Failure/no-charge and recovery paths need deliberate testing |

**Prerequisites:** S-01 shipped; Supabase auth/config working; `OPENAI_API_KEY` configured; one server-only PDF parsing library added during implementation.

**Estimated effort:** ~3 sessions across 4 phases.

## Open Risks & Assumptions

- Background recovery requires a small schema extension because current `practice_sets.status` is about practice progress, not generation lifecycle.
- PDF parsing is intentionally narrow in S-02; scanned/image-only resumes should fail clearly rather than triggering ad hoc OCR scope.
- Exact-20 validation may increase visible generation failures, but that is preferable to charging for malformed sets.

## Success Criteria (Summary)

- Signed-in user can go from dashboard entry to `/app/generate` and produce one persisted exact 20-question set.
- Malformed generation attempts fail clearly and do not increment generation usage.
- Leaving and returning during generation still results in one recoverable final set and one usage increment at most.
