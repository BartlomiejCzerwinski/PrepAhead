---
change_id: supabase-data-schema
status: plan_reviewed
created: 2026-05-28
updated: 2026-05-28
status_note: plan re-reviewed 2026-05-28 — SOUND (3 warnings)
notes: Rolling usage_periods; JSONB practice_sets; handle_new_user trigger; auth.uid() usage RPCs; plan-review fixes applied 2026-05-28
roadmap_ref: F-02
roadmap_outcome: (foundation) persist users, plans, usage, practice sets, and theme preference
prd_refs:
  - NFR (data isolation)
  - Access Control
  - FR-009
  - FR-010
  - FR-012
  - FR-014
  - FR-015
  - FR-019
  - FR-022
  - FR-023
---

# Change: supabase-data-schema

Foundation slice **F-02** from `context/foundation/roadmap.md`. Introduces the Supabase Postgres schema + RLS policy scaffolding and a migrations workflow so later slices (OAuth, usage dashboard, JD generation, Check) can build on stable, per-user persistence.

