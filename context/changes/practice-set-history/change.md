---
change_id: practice-set-history
title: Practice set history (view and reopen past sets)
status: implementing
created: 2026-06-28
updated: 2026-06-28
archived_at: null
roadmap: S-09
prd_refs:
  - FR-008
  - US-01
---

## Notes

Roadmap slice **S-09**: let a signed-in user view and reopen past generated practice sets from their account, satisfying **FR-008** (nice-to-have) and closing the last gap on the **US-01** account experience. Prerequisite **S-03** is met; no blockers, no open unknowns.

Decisions (from `/10x-plan` questioning; user accepted recommendations):
- **Placement:** new SSR page at `/app/sets` (`src/pages/app/sets/index.astro`), linked from the `/app` dashboard. Keeps the usage dashboard focused; mirrors the existing `/app/sets/[id]` route family.
- **Row contents:** rich — stored `title`, generation date, completed/in-progress badge, and progress summary (`X/15` MC answered · `Y/5` checked), plus ABCD score % when fully complete. Reuses existing derivation helpers.
- **Delete affordance:** none inline — rows link to `/app/sets/[id]`, which already has the confirm-then-delete button (S-07).
- **Scale:** show newest **50**, no pagination (`.order('created_at', desc).limit(50)`), hitting the existing partial index `practice_sets_user_active_idx`. Matches PRD "small data volume."
- **Empty state:** friendly copy + primary CTA to `/app/generate`.
- **No schema change.** Net-new UI on a mature data layer.
