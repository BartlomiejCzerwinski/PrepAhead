# Delete Practice Data (S-07) Implementation Plan

## Overview

Let a signed-in user delete a saved practice set they no longer want stored, satisfying PRD **FR-010**. Delete is implemented as a **soft-delete**: the set's `deleted_at` is stamped, which immediately hides it from every read path (overview, practice, open-ended, status, answer, check). A small confirm-then-delete control lives on the practice-set overview page and redirects to `/app` on success.

## Current State Analysis

- `practice_sets.deleted_at timestamptz` already exists (`supabase/migrations/20260530110000_create_practice_sets.sql:11`), and the `practice_sets_update_own` RLS policy + `grant ... update` already permit stamping it. **No migration is needed.**
- Every read already filters `.is('deleted_at', null)` — overview (`src/pages/app/sets/[id].astro:42`), practice/open-ended pages, and all four `[id]` API routes. A soft-deleted set disappears everywhere instantly.
- There is a working soft-delete precedent: `generate.ts:202-217` stamps `deleted_at` to discard an orphan draft on failed job creation.
- **No DELETE RLS policy / delete grant exists** on `practice_sets` or `generation_jobs`, and there is no service-role client. Hard delete would require a migration; soft-delete does not.
- The only per-set UI is the overview page `src/pages/app/sets/[id].astro` (no `/app` list, no history page — S-09 not built). Its footer action row (`[id].astro:322-329`) is the natural home for a delete control.
- No modal/dialog primitives exist (no shadcn). React islands use a shared `parseApiResponse` helper, `fetch` with `credentials: 'same-origin'`, the `{ ok: true } | { ok: false, error, message }` contract, and `window.location.assign(...)` to navigate.
- API ownership pattern is consistent: `.eq('id', id).eq('user_id', user.id).is('deleted_at', null)`, with mutations re-asserting the same triple filter and requiring `.select('id')` to return a row.

## Desired End State

A signed-in user, on the overview of a practice set they own, can click "Delete this set", confirm inline, and have the set soft-deleted. They are redirected to `/app`, and the set no longer appears on its overview or any practice flow (direct navigation to `/app/sets/[id]` redirects to `/app`). A non-owner or unauthenticated caller hitting the delete endpoint is denied (404 / 401) and no row is mutated. Usage counters are unchanged.

### Key Discoveries:

- Soft-delete is the established, migration-free mechanism — `generate.ts:202-217`, schema `:11`, read filters throughout.
- Atomic ownership-scoped UPDATE (`update({deleted_at}).eq('id').eq('user_id').is('deleted_at', null).select('id')`) detects non-owner/already-deleted via zero returned rows — no separate read needed.
- Island fetch conventions: `src/components/app/PracticeFlow.tsx:59-65,136-158`.

## What We're NOT Doing

- No hard delete / no new migration / no DELETE RLS policy.
- No usage refund (`usage_periods` untouched).
- No touching `generation_jobs` (terminal, inert once the set is hidden).
- No `/app` sets list or history page (that's S-09).
- No bulk delete, no undo/restore UI, no separate "delete all my data" account action.
- No scrubbing of JD/CV text columns (soft-delete leaves them in the row; revisit if a stronger privacy guarantee is later required).

## Implementation Approach

Add one server endpoint that performs the ownership-scoped soft-delete, and one small React island that confirms and calls it. Mount the island on the overview page. Cover the endpoint with integration tests mirroring the existing IDOR suite.

## Phase 1: Soft-delete endpoint

### Overview

A new server route that soft-deletes a practice set the caller owns.

### Changes Required:

#### 1. Delete API route

**File**: `src/pages/api/practice-sets/[id]/delete.ts`

**Intent**: Authenticate the caller, then soft-delete the named set by stamping `deleted_at`, scoped to the caller. Detect non-owner / missing / already-deleted via zero returned rows.

**Contract**: `export const prerender = false`; `export const POST: APIRoute`. Follows the auth + header-merge pattern of `answer.ts:59-88` (401 `unauthorized` when no user; 400 `missing_practice_set_id` when `params.id` empty). Mutation: `supabase.from('practice_sets').update({ deleted_at: <iso> }).eq('id', id).eq('user_id', user.id).is('deleted_at', null).select('id')`. On `error` → 500 `delete_failed`; on empty rows → 404 `practice_set_not_found`; on success → 200 `{ ok: true }`. Uses `jsonResponse`. Does not read or return any set content (no JD/CV/answer in any response).

### Success Criteria:

#### Automated Verification:

- Type checking + Astro check passes: `npm run astro -- check`
- Unit/integration tests pass: `npm test`

#### Manual Verification:

- POST to the route for a set you own returns `{ ok: true }` and the set vanishes from its overview.

---

## Phase 2: Delete control on overview

### Overview

A confirm-then-delete React island on the overview page.

### Changes Required:

#### 1. Delete island

**File**: `src/components/app/DeletePracticeSetButton.tsx`

**Intent**: Render a destructive "Delete this set" button that reveals an inline "Are you sure? Delete / Cancel" confirmation, POSTs to the delete endpoint, and redirects to `/app` on success; shows an error message on failure.

**Contract**: Default export React component, props `{ practiceSetId: string }`. States: `idle | confirming | deleting`. Uses the established `parseApiResponse` + `fetch('/api/practice-sets/${id}/delete', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })` pattern with a `submittingRef` double-submit guard; `window.location.assign('/app')` on `{ ok: true }`. Styling reuses existing utility classes (destructive button + secondary cancel) — no new design system.

#### 2. Mount on overview page

**File**: `src/pages/app/sets/[id].astro`

**Intent**: Render the delete island in the page's footer action row alongside "Generate another set", so it is always available for a loaded (owned, non-deleted) set.

**Contract**: Import the island; render `<DeletePracticeSetButton practiceSetId={practiceSetId} client:load />` within/after the action row at `[id].astro:322-329`. Place it so it shows even when content is not ready (the set still exists and is deletable) — i.e. not gated solely behind `contentReady`.

### Success Criteria:

#### Automated Verification:

- Astro check passes: `npm run astro -- check`
- Build succeeds: `npm run build`

#### Manual Verification:

- On an owned set's overview, "Delete this set" shows an inline confirm; confirming redirects to `/app` and the set is gone; navigating back to `/app/sets/[id]` redirects to `/app`.
- Cancel dismisses the confirm with no change.

---

## Phase 3: Endpoint tests

### Overview

Integration coverage for the delete endpoint mirroring the IDOR suite.

### Changes Required:

#### 1. Delete route tests

**File**: `test/integration/api/practice-sets/delete.test.ts`

**Intent**: Prove the endpoint denies non-owner and unauthenticated callers, soft-deletes correctly for the owner, and never leaks content. Kept separate from `idor.test.ts` because that suite asserts `updates.length === 0` for read-then-write routes, whereas delete's mutation is a single ownership-scoped UPDATE (it intentionally issues the UPDATE; the WHERE filter is the gate).

**Contract**: Mocks `createSupabaseServerClient` and uses `createFakeSupabase` / `makeApiContext`. Cases:
- Non-owner (seed `practice_sets.update = { data: [] }` / null): expect 404 `practice_set_not_found`; assert `filters` contains `{ table: 'practice_sets', column: 'user_id', value: <attacker> }` and `{ column: 'deleted_at', value: null }`; body contains no `JD_MARKER`/`CV_MARKER`/`ANSWER_MARKER`.
- Unauthenticated (`user: null`): expect 401.
- Owner happy path (seed `practice_sets.update = { data: [{ id }] }`): expect 200 `{ ok: true }`; assert an update was recorded with a `deleted_at` payload and the `user_id` + `deleted_at is null` filters.
- Missing id: expect 400 `missing_practice_set_id`.

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm test`

#### Manual Verification:

- n/a (covered by automated).

---

## Testing Strategy

### Unit Tests:

- None required (no new pure-logic module).

### Integration Tests:

- `delete.test.ts` — IDOR (404), auth (401), happy path (200 + soft-delete UPDATE), bad input (400). See Phase 3.

### Manual Testing Steps:

1. Sign in, open an owned set's overview, click "Delete this set", confirm → redirected to `/app`, set gone.
2. Navigate directly to the deleted set's URL → redirected to `/app`.
3. Click "Delete" then "Cancel" → no change.

## Migration Notes

None — soft-delete reuses the existing `deleted_at` column, RLS policy, and grant. No schema change, no deploy migration.

## References

- Roadmap: `context/foundation/roadmap.md` (S-07)
- PRD: `context/foundation/prd.md` (FR-010, line 164)
- Soft-delete precedent: `src/pages/api/practice-sets/generate.ts:202-217`
- Ownership pattern: `src/pages/api/practice-sets/[id]/answer.ts:115-121,235-244`
- Island fetch pattern: `src/components/app/PracticeFlow.tsx:59-65,136-158`
- Overview page: `src/pages/app/sets/[id].astro:322-329`
- IDOR suite: `test/integration/api/practice-sets/idor.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Soft-delete endpoint

#### Automated

- [x] 1.1 Astro check passes
- [x] 1.2 Tests pass

#### Manual

- [ ] 1.3 POST returns ok and set vanishes from overview

### Phase 2: Delete control on overview

#### Automated

- [x] 2.1 Astro check passes
- [x] 2.2 Build succeeds

#### Manual

- [ ] 2.3 Inline confirm → redirect → set gone; direct nav redirects to /app
- [ ] 2.4 Cancel dismisses with no change

### Phase 3: Endpoint tests

#### Automated

- [x] 3.1 Tests pass
