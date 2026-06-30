---
change_id: delete-practice-data
title: Delete a saved practice set (soft-delete)
status: impl_reviewed
created: 2026-06-28
updated: 2026-06-28
archived_at: null
roadmap: S-07
prd_refs:
  - FR-010
---

## Notes

Roadmap slice **S-07**: let a signed-in user delete a saved practice set they no longer want stored, satisfying **FR-010** (JD/CV are sensitive — delete-one-set is the minimum trust signal).

Decisions (from `/10x-plan` questioning; user deferred to recommendations):
- Mechanism: **soft-delete** — stamp `practice_sets.deleted_at` via the existing `practice_sets_update_own` policy. Zero migration; every read path already filters `deleted_at is null`.
- UX: small **React island** with inline "Are you sure?" confirm, reusing the existing fetch/`parseApiResponse`/`window.location.assign` pattern.
- Surface: **overview page only** (`/app/sets/[id]`) — no dashboard list / history page exists yet (S-09 not built).
- Usage: **no refund** — deleting does not decrement `usage_periods` (matches existing behavior, avoids quota farming).
- `generation_jobs`: **leave as-is** — job row is terminal and inert once the set is hidden.
