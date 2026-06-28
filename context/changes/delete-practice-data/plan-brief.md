# Delete Practice Data (S-07) — Plan Brief

> Full plan: `context/changes/delete-practice-data/plan.md`

## What & Why

Let a signed-in user delete a saved practice set they no longer want stored (PRD **FR-010**). JD/CV are sensitive, so a per-set delete is the minimum trust signal.

## Starting Point

The schema already has `practice_sets.deleted_at`, an UPDATE RLS policy that permits stamping it, and every read path already filters `deleted_at is null`. There's even a soft-delete precedent in `generate.ts`. The only per-set UI is the overview page `/app/sets/[id]`; no dashboard list or history page exists.

## Desired End State

On an owned set's overview, the user clicks "Delete this set", confirms inline, and the set is soft-deleted — they land on `/app` and the set is gone everywhere. Non-owner/unauthenticated delete calls are denied without mutating data; usage counters are unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Mechanism | Soft-delete (`deleted_at`) | Zero migration; matches existing precedent + all read filters | Plan |
| Confirmation UX | React island, inline confirm | Reuses existing fetch/redirect pattern, styled, no native confirm | Plan |
| Surface | Overview page only | Only per-set UI today; speed-biased per roadmap | Plan |
| Usage | No refund | Matches current behavior; prevents quota farming (AGENTS.md) | Plan |
| `generation_jobs` | Leave as-is | Terminal/inert once set is hidden | Plan |

## Scope

**In scope:** soft-delete endpoint, confirm island on overview, redirect to `/app`, integration tests.

**Out of scope:** hard delete / migration, usage refund, job mutation, `/app` list or history (S-09), bulk delete, undo UI, JD/CV column scrubbing.

## Architecture / Approach

New `POST /api/practice-sets/[id]/delete` performs an ownership-scoped `update({deleted_at}).eq('id').eq('user_id').is('deleted_at', null).select('id')` — zero rows ⇒ 404. A `DeletePracticeSetButton` island confirms then POSTs and `window.location.assign('/app')`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Endpoint | Soft-delete route | Ownership scoping must gate the UPDATE |
| 2. UI | Confirm island on overview | Confirm UX correctness; placement when content not ready |
| 3. Tests | IDOR + happy-path coverage | Keep separate from idor.test.ts (different update invariant) |

**Prerequisites:** S-02 (sets exist) — met.
**Estimated effort:** ~1 session, 3 small phases.

## Open Risks & Assumptions

- Soft-delete leaves JD/CV text physically in the row; acceptable for v1 trust signal. A future stronger-privacy ask would add column scrubbing or hard delete.

## Success Criteria (Summary)

- Owner can delete a set from its overview and it disappears everywhere; direct nav redirects to `/app`.
- Non-owner/unauthenticated delete is denied with no mutation or data leak.
- `npm test`, `npm run astro -- check`, and `npm run build` all pass.
