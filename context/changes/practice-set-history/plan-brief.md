# Practice Set History — Plan Brief

> Full plan: `context/changes/practice-set-history/plan.md`

## What & Why

Build a signed-in **practice set history** page so a user can view and reopen their past generated practice sets (roadmap **S-09**, **FR-008**). It closes the last gap on the **US-01** account experience — today a user can generate and complete a set but has no way to find earlier ones.

## Starting Point

The data layer is fully ready: `practice_sets` already stores `title`, `created_at`, `status`, `cv_text`, and `content`, with a purpose-built partial index for "my active sets, newest first." All per-row derivation helpers exist. But **no list view exists** — `/app` shows only the usage dashboard and every read today is single-row by id.

## Desired End State

`/app/sets` lists the user's non-deleted sets newest-first (capped at 50) as cards — title, generation date, completed/in-progress badge, and a progress line (`X/15` answered · `Y/5` checked, score % when complete) — each linking to the existing `/app/sets/[id]` overview (where reopen and delete already live). No sets → a friendly empty state CTAing to `/app/generate`. The `/app` dashboard links into the page.

## Key Decisions Made

| Decision           | Choice                                              | Why (1 sentence)                                                       | Source |
| ------------------ | --------------------------------------------------- | --------------------------------------------------------------------- | ------ |
| Placement          | New SSR page `/app/sets`, linked from `/app`         | Keeps the usage dashboard focused; mirrors the `/app/sets/[id]` family | Plan   |
| Row contents       | Rich: title + date + status badge + progress/score   | Genuinely useful at a glance; reuses existing derivation helpers       | Plan   |
| Delete affordance  | None inline — rows link to the set's overview         | Avoids duplicating the S-07 confirm-then-delete UX; smallest scope     | Plan   |
| Scale              | Newest 50, no pagination                              | Hits the existing partial index; matches PRD "small data volume"       | Plan   |
| Empty state        | Friendly copy + CTA to `/app/generate`               | Turns a dead end into the core action                                  | Plan   |
| Data access        | New lib reader (no API route); SSR page calls it      | Matches `/app/*` SSR convention; makes user-scoping unit-testable      | Plan   |

## Scope

**In scope:** `src/lib/practice/history.ts` (mapper + reader), `src/pages/app/sets/index.astro`, a dashboard link, unit + scoping tests.

**Out of scope:** schema/migration changes, inline delete, pagination, JD/CV snippets, any change to generation/practice/billing, app-nav redesign.

## Architecture / Approach

A thin SSR page calls a lib reader that runs one user-scoped, soft-delete-aware, ordered, capped query (`.eq('user_id').is('deleted_at', null).order('created_at', desc).limit(50)`) and maps each row to a `PracticeSetSummary` via a pure, tolerant mapper (catches `PracticeSetContractError` for legacy content). The page renders cards via `AppLayout`; rows link to `/app/sets/[id]`.

## Phases at a Glance

| Phase                                   | What it delivers                                   | Key risk                                                |
| --------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| 1. History data layer                   | Mapper + reader + unit/scoping tests               | Tolerant parse of legacy/unparseable `content` rows     |
| 2. History page UI + dashboard entry    | `/app/sets` page, empty state, dashboard link      | Theme/markup consistency with existing `/app` surfaces  |

**Prerequisites:** none — S-03 shipped; data layer and helpers already exist.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Per-row `parsePracticeSetWithProgress` runs ≤50×/load — fine at MVP volumes; the cap is the mitigation.
- The fake Supabase harness does not record `.order()`/`.limit()`, so those are verified by code review + `astro check`, not the scoping test.
- Assumes stored `title` (JD-derived) is acceptable as the row label (no raw JD/CV exposed, per AGENTS.md).

## Success Criteria (Summary)

- A signed-in user can see their past sets at `/app/sets` and reopen any of them.
- New accounts see a useful empty state that routes to generation.
- No other user's data is reachable (user-scoped + soft-delete-filtered, asserted by tests).
