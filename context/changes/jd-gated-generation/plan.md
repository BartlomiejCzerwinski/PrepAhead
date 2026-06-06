# JD-gated generation Implementation Plan

## Overview

Implement **S-02** from `context/foundation/roadmap.md`: add a dedicated signed-in generation flow where a user can paste a job description, optionally upload a **PDF CV** that is parsed into internal `resumeText`, request generation once, see a staged loading screen, and end on a generated-set overview only when the app has produced and validated an **exact 20-question** mixed practice set. Successful generations must persist to `practice_sets` and increment generation usage only after the set is valid and saved. Because the UX requires leave-and-return recovery, this slice also includes a minimal durable async generation-job design rather than assuming one foreground request survives page exit.

This slice proves the product's north-star value without pulling the answer loop, score summary, or Check flow forward from **S-03** / **S-04**.

## Current State Analysis

- `/app` already exists as a signed-in usage dashboard and is protected by middleware; there is no generation route, no generation CTA, and no post-generation route in `src/pages/app/`.
- The data layer is ready for user-scoped practice sets and quota metering: `practice_sets` exists with sensitive `job_description_text`, optional `cv_text`, and `content jsonb`, while `increment_generation_usage()` already exists for atomic monthly usage increments.
- There is no file-upload pattern, no PDF parsing helper, no provider integration, no generation endpoint, and no TypeScript contract for generated practice-set content in `src/`.
- React is installed and enabled in `astro.config.mjs`, but the current signed-in surface is Astro-only. This slice is the first one that benefits from an interactive island because it needs upload state, staged progress, and recovery behavior.

## Desired End State

After this plan is complete:

1. A signed-in user can open **`/app/generate`**, paste a job description, optionally upload a PDF CV, and submit one generation request at a time.
2. PDF upload is parsed server-side into resume text immediately after upload. The parsed text is used for generation but is **not** shown for manual editing in S-02.
3. The app enforces plan limits before generation, blocks at the FREE limit with the existing upgrade path, and increments generation usage **only after** a valid practice set has been saved successfully.
4. The generation pipeline returns a persisted practice set containing an **exact 20-question** mixed set aligned with the PRD's intended structure: **15 ABCD + 5 open-ended**.
5. Invalid, partial, or malformed provider output fails the request cleanly, shows a user-safe error, and does **not** consume a generation.
6. The user sees a staged loading screen while generation runs. If they leave the page, recovery is driven by a durable generation-job record; when they return, the app can recover the in-flight or newly completed result and route them to the generated-set overview.
7. A generated-set overview route proves success and shows the newly created set without implementing the full answer loop from S-03.

### Key Discoveries

- `src/pages/app/index.astro` and `src/components/app/AppLayout.astro` already provide the signed-in shell S-02 should extend rather than replacing.
- `supabase/migrations/20260530110000_create_practice_sets.sql` already stores `job_description_text`, nullable `cv_text`, and `content jsonb`, so S-02 should persist one row per generation request instead of introducing question-specific tables.
- `supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql` already defines `increment_generation_usage()` using `auth.uid()`, which means normal metering should continue to use the user JWT path rather than a service-role write.
- There is no existing file-upload or PDF parsing code in `src/`, so the upload requirement is a real new capability and needs explicit error handling and scope limits.
- `astro.config.mjs` already enables React and a 60-second Vercel server duration, which fits a generated loading flow without reworking deployment configuration.

## What We're NOT Doing

- DOCX upload, multi-file upload, drag-and-drop polish, or OCR for scanned/image-only PDFs
- Editable parsed CV text in S-02
- Full question answering, immediate ABCD feedback, progress through the set, or score summary (S-03)
- Open-ended Check feedback and Check quota consumption (S-04)
- Practice-set history as a full index/list feature (S-09)
- Regenerate-same-JD UX (FR-011)
- PRO daily-cap enforcement beyond existing display rules deferred to S-05
- External queue infrastructure or webhook-style async orchestration beyond a minimal DB-backed generation-job flow needed for S-02

## Implementation Approach

Add a dedicated **`/app/generate`** route that renders a React island inside the existing signed-in shell. The island owns the JD text area, optional PDF upload state, staged loading screen, and recovery UX. PDF upload is handled by a server-only parse endpoint that returns extracted resume text for hidden in-memory/form state. Submission creates a durable generation job that can be recovered independently of the browser page that started it.

The flow becomes:

1. verifies the signed-in user and current plan status,
2. creates a durable generation-job record plus its associated placeholder `practice_sets` row,
3. starts or triggers one server-side worker/claim path for that job,
4. calls the model provider server-side,
5. validates the returned structure against the exact-20 contract,
6. finalizes the `practice_sets` payload,
7. increments generation usage only after finalization succeeds,
8. marks the job as succeeded or failed,
9. returns or exposes the job/set id for redirect to the overview page.

Recovery is DB-backed rather than browser-only. `/app/generate` reattaches to the durable generation job and redirects once that job reaches a terminal state, rather than assuming the original request stayed alive after navigation away.

## Critical Implementation Details

**Background recovery needs a real job model.** The existing codebase has no queue/worker primitive, so "keep running after the user leaves" cannot remain an implied property of one HTTP request. S-02 needs an explicit durable job surface such as a `generation_jobs` table plus a claim/finalize execution path that lets `/app/generate` poll by job id and recover after navigation away.

**Generation lifecycle should not overload practice progress.** The existing `practice_sets.status` models practice progress (`in_progress` / `completed`), not generation progress. The generation job should own the async lifecycle (`queued` / `running` / `succeeded` / `failed` or equivalent) while `practice_sets.status` remains reserved for later S-03 answer-loop semantics.

**Exact-20 is a server contract, not just prompt intent.** The provider response must be validated after generation and before persistence/metering. If the returned set is missing items, over-produces, or violates the fixed 15 ABCD + 5 open-ended composition, S-02 should fail cleanly and leave generation usage untouched.

**Finalization must be idempotent and DB-owned.** S-02 should not rely on route code to "save the set, then increment usage" as two loosely coupled steps. The durable job needs one finalization contract keyed by job id that can be retried safely and guarantees one saved final set plus one generation increment at most.

**Parsed CV text is intentionally hidden in S-02.** Because the user chose upload-to-`resumeText` without manual review, parse quality problems have to surface as upload-time errors or generation-time failures; the UI must not imply that the parsed text was human-reviewed.

## Phase 1: Generation entry flow

### Overview

Add the signed-in route, dashboard entry point, and interactive generation form shell that collects JD text plus an optional PDF CV and enforces one-submit-at-a-time behavior in the browser.

### Changes Required:

#### 1. Dashboard entry point

**File**: `src/components/app/UsageDashboard.astro`

**Intent**: Give signed-in users a clear path from the existing dashboard to the dedicated generation flow.

**Contract**: Add a primary CTA to `/app/generate`. Reuse the existing at-limit FREE banner pattern so users who have zero remaining generations are still shown an upgrade path instead of a misleading "start generation" call to action.

#### 2. Dedicated generation page

**File**: `src/pages/app/generate.astro`

**Intent**: Establish the signed-in generation route as the home of S-02.

**Contract**: `export const prerender = false`. Reuse `AppLayout.astro`. Server frontmatter loads the authenticated user plus current usage summary and any recoverable in-flight/latest generation metadata needed to hydrate the client island. Redirect unauthenticated visitors to `/login` through the existing `/app/*` gate.

#### 3. Interactive generation flow island

**File**: `src/components/app/GeneratePracticeFlow.tsx`

**Intent**: Handle JD input, optional PDF upload, staged loading, duplicate-submit prevention, and recovery UI in one interactive surface that Astro alone does not handle cleanly.

**Contract**:

- Accept props for `usageSummary`, initial recovery state, and any pre-known latest ready set id.
- Render:
  - JD textarea
  - Optional PDF upload control labeled clearly as optional
  - Hidden/internal `resumeText` state populated only from the parse endpoint
  - Submit button disabled while parsing or generating
  - No-CV behavior limited to field-label/helper copy only
- Enforce single in-flight submission in the client: once generation begins, the form swaps to a loading screen and does not allow a second click.
- Show staged progress copy while generation runs.
- When a PDF is uploaded successfully, show confirmation that the CV was accepted/parsed without exposing editable parsed text.

#### 4. Upload/parse UX copy and constraints

**File**: `src/components/app/GeneratePracticeFlow.tsx`

**Intent**: Make the upload path understandable without turning S-02 into a document-management feature.

**Contract**: Accept PDF only. Show user-safe parse failures (unsupported file, unreadable PDF, empty extraction, oversize input). Explicitly do not promise OCR or DOCX support. Keep wording aligned with the PRD's honesty guardrail.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- Build includes the new `/app/generate` on-demand route without breaking `/app`

#### Manual Verification:

- Signed-in user can navigate from `/app` to `/app/generate`
- The generation form accepts JD text and an optional PDF upload
- While parsing or generating, the submit action cannot be triggered a second time
- A user who skips CV upload can still continue with JD-only input

**Implementation Note**: After Phase 1, pause for manual confirmation that the route, input flow, and single-submit browser behavior feel correct before building the server pipeline.

---

## Phase 2: Server generation pipeline

### Overview

Add the server-only parsing and generation contracts, the durable job schema, and the persistence/metering flow that turns one queued request into one valid practice set.

### Changes Required:

#### 1. Durable generation job schema

**File**: `supabase/migrations/<timestamp>_generation_jobs.sql`

**Intent**: Persist enough state to recover in-flight and completed generations without confusing async job lifecycle with later practice completion state.

**Contract**:

- Add a dedicated `generation_jobs` table (or equivalent durable job surface) owned by the signed-in user.
- Include:
  - stable job id
  - `practice_set_id`
  - async lifecycle state (`queued` / `running` / `succeeded` / `failed` or equivalent)
  - idempotency key or equivalent dedupe handle
  - optional failure metadata safe for internal debugging and user-safe mapping
  - timestamps for claim/start/finish
- Preserve the existing user-ownership and RLS model.
- Keep `practice_sets.status` unchanged; S-03 still needs `in_progress` / `completed` for answering behavior later.

#### 1a. Finalization RPC / transaction contract

**File**: `supabase/migrations/<timestamp>_finalize_generation_job.sql`

**Intent**: Make practice-set persistence and usage metering one idempotent finalization step instead of two loosely ordered route actions.

**Contract**:

- Add one DB-owned finalization primitive keyed by durable job id.
- It must:
  - verify the job is still claimable/finalizable
  - persist the final `practice_sets` payload
  - increment generation usage exactly once
  - mark the job succeeded
- Re-running the same finalization for the same job must be safe and must not double-increment usage or create a second final set.
- Failure-path updates should mark the job failed without consuming generation usage.

#### 2. PDF parsing endpoint

**File**: `src/pages/api/resume/parse.ts`

**Intent**: Convert an uploaded PDF into plain resume text immediately after upload without exposing provider keys or doing parsing in the browser.

**Contract**:

- `export const prerender = false`
- Accept authenticated POST requests only from signed-in users
- Instantiate `createSupabaseServerClient(request, cookies, headers)`, call `auth.getUser()`, and merge auth response headers on the way out just like the existing auth routes
- Accept a single PDF file, reject non-PDF inputs, and return structured JSON with extracted `resumeText`
- Never persist uploaded binary data in S-02; only the extracted text that later feeds generation
- Never log raw resume text or file content

#### 3. PDF parsing helper

**File**: `src/lib/server/resume/parse-pdf.ts`

**Intent**: Isolate the server-only PDF-to-text logic so the route stays small and replaceable.

**Contract**: Expose a single helper that converts a PDF payload into normalized text, enforces size/emptiness checks, and returns sanitized parse errors the API route can map into user-facing states. The implementation may introduce a server-only PDF parsing dependency, but no client bundle may import it.

#### 4. Practice-set content contract

**File**: `src/lib/practice/contracts.ts`

**Intent**: Define the application-level shape that generated content must satisfy before it can be saved.

**Contract**:

- Export TypeScript types and runtime validation for:
  - exactly 20 questions
  - 15 `abcd` items
  - 5 `open_ended` items
  - question ids, prompts, option structure, correct answer/explanation fields where needed
- Use the repo's existing schema-first runtime validation style for parsing/validation rather than introducing a bespoke validator pattern for this slice.
- Produce a normalized `practice_sets.content` payload that later S-03/S-04 can reuse rather than reinventing shape assumptions.

#### 5. Generation service

**File**: `src/lib/server/practice/generate-practice-set.ts`

**Intent**: Centralize provider prompting, response normalization, and validation away from the API route.

**Contract**:

- Read `OPENAI_API_KEY` through `requireEnv()`
- Accept JD text plus optional parsed `resumeText`
- Apply the honesty constraint: when no CV exists, the request must remain JD-only
- Return a validated, exact-20 practice-set payload or a structured failure
- Keep provider-specific details out of the client and out of `src/pages/app/*`

#### 6. Generation endpoint

**File**: `src/pages/api/practice-sets/generate.ts`

**Intent**: Create a durable generation job and start the generation pipeline safely.

**Contract**:

- `export const prerender = false`
- Authenticated POST only
- Instantiate `createSupabaseServerClient(request, cookies, headers)`, call `auth.getUser()`, and merge auth response headers; do not assume middleware protects `/api/practice-sets/*`
- Flow order:
  1. load current usage summary
  2. block if the user is already at the generation limit
  3. create a `generation_jobs` row plus its associated placeholder `practice_sets` row
  4. start or trigger the worker/claim path for that job
  5. return the job id immediately so the UI can recover/poll against a durable identifier
- The route must not rely on the original browser request surviving until provider completion.
- On malformed or partial output: the worker/finalizer marks the job as failed, returns a clear status to the polling UI, and does **not** call `increment_generation_usage()`
- On provider/config errors: return user-safe error codes without exposing secrets or raw prompt content

#### 7. Generation worker/finalizer

**File**: `src/pages/api/practice-sets/generate-worker.ts` (or equivalent internal execution path)

**Intent**: Claim one queued job, run provider generation, and move the job to a terminal state without depending on the original page request.

**Contract**:

- Runs server-side only and operates on one durable job id at a time
- Claims queued work idempotently so duplicate execution attempts do not create duplicate final sets
- Calls the generation service, validates exact-20 output, then invokes the DB finalization primitive so `practice_sets` persistence and generation metering happen exactly once
- Leaves enough job metadata for `/app/generate` and the status route to recover cleanly after navigation away

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- Supabase migration applies cleanly in local reset workflow when implementation begins

#### Manual Verification:

- Uploading a valid PDF returns parsed resume text for the generation flow
- A successful generation creates one `practice_sets` row with exact-20 normalized content through one durable job finalization path
- A malformed provider result fails cleanly and does not increment generation usage
- A FREE user at limit is blocked before generation starts and is shown the upgrade path
- One queued job reaches one terminal state without duplicate finalization
- Retrying finalization for the same job does not create a duplicate set or duplicate generation increment

**Implementation Note**: Pause after Phase 2 and manually verify one success path and one malformed-output path before layering recovery and overview UX.

---

## Phase 3: Loading, recovery, and overview

### Overview

Turn the durable job pipeline into a resilient user flow: staged loading, leave-page notification, recovery on return, and a read-only generated-set overview that proves the system worked.

### Changes Required:

#### 1. Generation status/read endpoint

**File**: `src/pages/api/practice-sets/[id]/status.ts`

**Intent**: Let the client island poll or reattach to the durable generation job state without exposing other users' records.

**Contract**:

- `export const prerender = false`
- Authenticated GET only
- Instantiate `createSupabaseServerClient(request, cookies, headers)`, call `auth.getUser()`, and merge auth response headers; do not rely on `/api/auth/*`-only middleware behavior
- Return only the signed-in user's durable job state and redirect target data needed by the UI
- Map failed states to user-safe error payloads

#### 2. Recovery query on generation page

**File**: `src/pages/app/generate.astro`

**Intent**: Rehydrate the generation flow when the user returns after leaving mid-run.

**Contract**: On SSR load, inspect the signed-in user's most recent relevant generation job(s) and pass enough initial state to the React island to either:

- resume showing the in-flight loading state,
- redirect to a newly ready overview,
- or show a failed-generation retry state.

This must stay intentionally smaller than a full history feature.

#### 3. Leave-page notification and background continuation

**File**: `src/components/app/GeneratePracticeFlow.tsx`

**Intent**: Honor the requirement that the app warns on leaving while the durable job remains recoverable.

**Contract**:

- Show a notification or leave warning when possible during an active generation
- Do not cancel the durable job just because the user left the page
- On return, recover by polling/status lookup rather than asking the user to start over blindly

#### 4. Generated-set overview page

**File**: `src/pages/app/sets/[id].astro`

**Intent**: Give S-02 a concrete success destination without implementing the full answering flow.

**Contract**:

- `export const prerender = false`
- Authenticated page scoped by RLS/user ownership
- Show:
  - title
  - generation completion state
  - high-level summary of the newly generated set
  - read-only list or grouped preview of the 20 generated questions
- Do not add answer submission, scoring, or Check controls; that remains S-03/S-04 scope.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- Dynamic `/app/sets/[id]` route builds and type-checks cleanly

#### Manual Verification:

- User sees a staged loading screen during generation
- Leaving the page shows a notification/warning when possible and does not consume an extra generation
- Returning to `/app/generate` during or after generation recovers the active/newly completed request
- A successful run lands on a generated-set overview page that shows the exact 20 generated questions in read-only form

**Implementation Note**: Pause after Phase 3 for human confirmation that the success destination is sufficient proof of value without overreaching into S-03.

---

## Phase 4: Verification and change hygiene

### Overview

Capture implementation verification, tighten operational notes, and leave the change ready for `/10x-implement`.

### Changes Required:

#### 1. Verification log

**File**: `context/changes/jd-gated-generation/verification.md`

**Intent**: Record the exact build/check/manual outcomes for this slice.

**Contract**: Include checks for:

- build
- `astro check`
- PDF parse success and parse failure
- FREE limit block path
- malformed-output no-charge path
- leave-page recovery path
- generated-set overview rendering

#### 2. Change status hygiene

**File**: `context/changes/jd-gated-generation/change.md`

**Intent**: Keep the change metadata aligned with implementation progress.

**Contract**: `status: planned` until implementation completes. Update `updated:` when the plan lands; later `/10x-implement` can move status forward according to the normal workflow.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- A signed-in FREE user can complete the happy path from `/app` to `/app/generate` to a generated-set overview
- A malformed generation attempt leaves quota unchanged
- Leaving and returning during generation results in one eventual set, not duplicate sets or duplicate usage increments

---

## Testing Strategy

### Unit Tests:

- Not a new test-runner slice. Keep automated verification focused on `npm run build` and `npm run astro -- check`.
- Where practical during implementation, prefer small runtime validators around generated payload normalization instead of broad test scaffolding.

### Integration Tests:

- Manual only for MVP:
  - signed-in generation happy path
  - parse failure path
  - malformed-output/no-charge path
  - FREE limit block path
  - leave-page recovery path through the durable job/status flow

### Manual Testing Steps:

1. Sign in as a FREE user and navigate from `/app` to `/app/generate`.
2. Paste a JD only and generate successfully; verify one new practice set and one generation increment.
3. Upload a valid PDF CV, generate successfully, and confirm the saved row includes `cv_text`.
4. Force a malformed provider response or validation failure; verify no generation increment occurs.
5. Start generation, leave the loading screen, then return; verify the request recovers and lands on one final overview.
6. Set the FREE generation count to the limit; verify the flow blocks before a provider call begins and points the user to upgrade.

## Performance Considerations

- PDF parsing and any single job-execution attempt must fit within the existing 60-second Vercel function budget. Reject obviously invalid/oversize PDFs before provider work begins.
- The staged loading UI is important because parsing plus generation may approach the upper end of acceptable latency even on successful runs.
- Recovery should query only the minimum recent generation data needed for the current user rather than evolving into a full history surface.

## Migration Notes

- S-02 requires at least one new Supabase migration to add a durable generation-job surface separate from practice-progress status.
- Existing `practice_sets` rows from future or manual testing should remain compatible because the durable job lifecycle is tracked separately from `practice_sets.status`; no data backfill beyond sensible defaults should be required.
- No billing or PRO daily-cap migration is in scope here.

## References

- Roadmap: `context/foundation/roadmap.md` — S-02
- PRD: `context/foundation/prd.md` — FR-002, FR-003, FR-004, FR-014, FR-015, US-01
- Existing dashboard entry point: `src/pages/app/index.astro`
- Existing signed-in shell: `src/components/app/AppLayout.astro`
- Existing usage gate/read path: `src/components/app/UsageDashboard.astro`, `src/lib/plan/get-usage-summary.ts`
- Practice set schema: `supabase/migrations/20260530110000_create_practice_sets.sql`
- Usage increment RPC: `supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql`
- Server env helper: `src/lib/server/env.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Generation entry flow

#### Automated

- [ ] 1.1 `npm run build` — exit 0
- [ ] 1.2 `npm run astro -- check` — exit 0
- [ ] 1.3 New `/app/generate` route type-checks and does not regress `/app`

#### Manual

- [ ] 1.4 Signed-in user can navigate from `/app` to `/app/generate`
- [ ] 1.5 Generation form accepts JD text and an optional PDF upload
- [ ] 1.6 Submit cannot be triggered a second time while parsing or generating
- [ ] 1.7 JD-only submission path remains available when CV is skipped

### Phase 2: Server generation pipeline

#### Automated

- [ ] 2.1 `npm run build` — exit 0
- [ ] 2.2 `npm run astro -- check` — exit 0
- [ ] 2.3 Supabase migration applies cleanly in local reset workflow

#### Manual

- [ ] 2.4 Valid PDF upload returns parsed resume text for generation
- [ ] 2.5 Successful generation creates one persisted exact-20 practice set
- [ ] 2.6 Malformed provider output fails without incrementing generation usage
- [ ] 2.7 FREE user at limit is blocked before generation begins
- [ ] 2.8 One queued job reaches one terminal state without duplicate finalization
- [ ] 2.9 Retrying finalization for the same job does not create a duplicate set or duplicate increment

### Phase 3: Loading, recovery, and overview

#### Automated

- [ ] 3.1 `npm run build` — exit 0
- [ ] 3.2 `npm run astro -- check` — exit 0
- [ ] 3.3 Dynamic `/app/sets/[id]` route builds and type-checks cleanly

#### Manual

- [ ] 3.4 Staged loading screen appears during generation
- [ ] 3.5 Leaving the page warns when possible and does not create duplicate usage
- [ ] 3.6 Returning to `/app/generate` recovers the in-flight or newly completed generation
- [ ] 3.7 Generated-set overview shows the exact 20 generated questions in read-only form

### Phase 4: Verification and change hygiene

#### Automated

- [ ] 4.1 `npm run build` — exit 0
- [ ] 4.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 4.3 Happy path works from dashboard entry to generated-set overview
- [ ] 4.4 Malformed generation leaves quota unchanged
- [ ] 4.5 Leave-and-return recovery produces one final set without duplicate increments
