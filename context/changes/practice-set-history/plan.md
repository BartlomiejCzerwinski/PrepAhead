# Practice Set History Implementation Plan

## Overview

Add a signed-in **practice set history** surface so a user can view and reopen their past generated practice sets (roadmap **S-09**, **FR-008**, completing the **US-01** account experience). The feature is a single new server-rendered page at `/app/sets` that lists the user's non-deleted sets newest-first (capped at 50), each row showing the stored title, generation date, a completed/in-progress badge, and a progress/score summary, linking to the existing `/app/sets/[id]` overview. A friendly empty state CTAs to `/app/generate`, and the `/app` dashboard gains a link into the history page.

No schema change. This is net-new UI on a mature data layer.

## Current State Analysis

- **No list view of `practice_sets` exists.** `/app` (`src/pages/app/index.astro:27-30`) renders only `UsageDashboard`; it never queries `practice_sets`. Every existing read is single-row by id.
- **The data row already carries everything a rich row needs**, no joins: `title` (JD-derived at generation and stored, `src/lib/practice/contracts.ts:346`), `created_at`, `status` (`'in_progress' | 'completed'`), `cv_text`, and `content` jsonb. Schema: `supabase/migrations/20260530110000_create_practice_sets.sql:5-18`.
- **A purpose-built partial index already exists** for this exact query: `practice_sets_user_active_idx (user_id, created_at desc) where deleted_at is null` (`supabase/migrations/20260530110000_create_practice_sets.sql:26-27`).
- **All per-row derivation helpers exist** in `src/lib/practice/`: `parsePracticeSetWithProgress` (`contracts.ts:299`), `scoreAbcdPractice` (`score-abcd.ts:44`), `getAbcdProgress` (`score-abcd.ts:20`), `getOpenEndedProgress` (`score-open-ended.ts:22`), `isPracticeSetFullyComplete` (`score-open-ended.ts:57`). `PracticeSetContractError` (`contracts.ts:123`) is thrown for unparseable/legacy content and must be caught (the overview page does this at `[id].astro:78-82`).
- **The exact list query pattern is already used single-row** at `src/pages/app/sets/[id].astro:38-44`: `.select(...).eq('user_id', user.id).is('deleted_at', null)`. The history list is the same minus `.eq('id', ...)`, plus `.order('created_at', { ascending: false }).limit(...)`.
- **Conventions:** `/app/*` pages are Astro SSR (`export const prerender = false`), auth via `Astro.locals.user` populated by `src/middleware.ts`, redirect to `/login` when absent. Shared shell is `AppLayout.astro` (no inter-page nav bar — links live in page bodies). Supabase access via `createSupabaseServerClient(Astro.request, Astro.cookies)` (`src/lib/supabase/server.ts:10`).
- **Test harness** mocks at the Supabase client boundary via `createFakeSupabase` (`test/support/fake-supabase.ts`) and asserts user-scoping through `fake.calls.filters` (the IDOR discipline in `test/integration/api/practice-sets/idor.test.ts:129-140`). Unit tests use inline-literal oracles (`src/lib/plan/limits.test.ts`). Note the fake records `.eq()`/`.is()` filters but treats `.order()`/`.limit()` as no-ops (`fake-supabase.ts:117-123`), so order/limit are verified by code review + `astro check`, not by the harness.
- **Quality gates:** `astro check` runs as a stop hook (`.cursor/hooks/lint-typecheck.mjs`); `vitest` for tests; `npm run build` for the build. Commands in `package.json`.

## Desired End State

A signed-in user navigating to `/app/sets` (or following the new "Your practice sets" link from `/app`) sees their non-deleted practice sets, newest first, each as a card showing title, "Generated <date>", a status badge, and a progress line (`X/15` multiple-choice answered · `Y/5` checked; ABCD score % when fully complete). Clicking a card opens `/app/sets/[id]` where they can resume practice or delete. With no sets, they see a short message and a primary "Generate your first set" button to `/app/generate`. Unauthenticated access to `/app/sets` redirects to `/login`. No other user's data is ever reachable.

Verification: `astro check` passes, `vitest` passes (new unit + scoping tests green), `npm run build` succeeds, and manual walkthrough confirms list, empty state, reopen, and auth redirect.

### Key Discoveries:

- Reuse the single-row query pattern verbatim, dropping `.eq('id', ...)`: `src/pages/app/sets/[id].astro:38-44`.
- Per-row status derivation must mirror the overview's tolerant parse: catch `PracticeSetContractError` and degrade to a "still preparing" row rather than throwing (`[id].astro:70-82`).
- The completed badge should match the overview's effective rule: `status === 'completed' || isPracticeSetFullyComplete(content)` (`[id].astro:90-91`).
- The partial index wants `.order('created_at', { ascending: false })` to be used — keep the order column as `created_at`.

## What We're NOT Doing

- No schema/migration changes, no new columns (no stored snippet, no score column).
- No inline delete from the list — rows link to `/app/sets/[id]`, which already has confirm-then-delete (S-07).
- No pagination or infinite scroll — capped at the newest 50.
- No new API endpoint — the page is SSR like the rest of `/app/*`.
- No JD/CV snippet in rows or logs (sensitive per AGENTS.md); rows show only the already-derived `title`.
- No changes to generation, practice, open-ended, or billing flows.
- No global app nav bar redesign (out of scope; just a link from `/app`).

## Implementation Approach

Two phases. Phase 1 builds a small, testable data layer (`src/lib/practice/history.ts`): a pure row→view-model mapper and a user-scoped, soft-delete-aware, capped list reader, with a unit test (mapper) and a Supabase-boundary scoping test (IDOR discipline). Phase 2 builds the SSR page (`src/pages/app/sets/index.astro`) that calls the reader and renders rows + empty state via `AppLayout`, plus a link from the `/app` dashboard.

## Phase 1: History data layer

### Overview

Create `src/lib/practice/history.ts` with the row mapper and list reader so the page stays thin and the scoping/derivation logic is unit-tested.

### Changes Required:

#### 1. History view-model + mapper + reader

**File**: `src/lib/practice/history.ts` (new)

**Intent**: Provide a `PracticeSetSummary` view model and a pure mapper that turns a raw `practice_sets` row into it (tolerant of unparseable `content`), plus a reader that runs the user-scoped, soft-delete-aware, ordered, capped query and maps the results. Keeping the query in a lib function makes user-scoping unit-testable against the fake Supabase client.

**Contract**:
- Export `const PRACTICE_SET_HISTORY_LIMIT = 50`.
- Export `type PracticeSetSummary = { id: string; title: string; createdAt: string; statusLabel: 'completed' | 'in_progress'; contentReady: boolean; abcdAnswered: number; abcdTotal: 15; openEndedChecked: number; openEndedTotal: 5; abcdScorePercent: number | null; hasCv: boolean }`. `abcdScorePercent` is non-null only when the set is fully complete; `contentReady === false` for rows whose `content` fails `parsePracticeSetWithProgress` (badge falls back to the row's `status`).
- Export `toPracticeSetSummary(row): PracticeSetSummary` — pure. Input row shape mirrors the existing select: `{ id, title, status, content, created_at, cv_text }`. It parses `content` inside a try/catch on `PracticeSetContractError` (re-throw anything else, matching `[id].astro:78-82`); on success derives `abcdAnswered`/`openEndedChecked` via `getAbcdProgress`/`getOpenEndedProgress`, sets `statusLabel` using `status === 'completed' || isPracticeSetFullyComplete(content)`, and sets `abcdScorePercent` from `scoreAbcdPractice(content).percent` only when fully complete; on parse failure returns a row with `contentReady: false`, zeroed counts, `abcdScorePercent: null`, and `statusLabel` from the raw `status`.
- Export `async listPracticeSetSummaries(supabase: SupabaseClient, userId: string, limit = PRACTICE_SET_HISTORY_LIMIT): Promise<{ ok: true; data: PracticeSetSummary[] } | { ok: false }>`. Runs `.from('practice_sets').select('id, title, status, content, created_at, cv_text').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(limit)`; on `error` returns `{ ok: false }`; otherwise maps rows through `toPracticeSetSummary` and returns `{ ok: true, data }`. Follow the `getUsageSummary` result-object convention used by the dashboard (`src/lib/plan`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run astro -- check`
- Unit + scoping tests pass: `npx vitest run`
- Build passes: `npm run build`

#### Manual Verification:

- N/A for this phase (pure lib + tests).

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

#### 2. Unit test for the mapper

**File**: `src/lib/practice/history.test.ts` (new)

**Intent**: Lock the row→view-model derivation with inline-literal oracles (the `limits.test.ts` convention).

**Contract**: Cover, using fixture `content` built from the existing contracts: (a) a fully-complete set → `statusLabel: 'completed'`, `abcdScorePercent` a concrete integer, correct `abcdAnswered`/`openEndedChecked`; (b) an in-progress set → `statusLabel: 'in_progress'`, `abcdScorePercent: null`, partial counts; (c) a set with `status: 'completed'` from the row but partial content (grandfathered) → still `'completed'`; (d) unparseable/empty `content` → `contentReady: false`, zeroed counts, `statusLabel` from raw `status`. Build valid fixture content by reusing the practice contracts/schema rather than hand-rolling 20 questions where practical.

#### 3. Scoping test for the reader

**File**: `test/integration/api/practice-sets/history.test.ts` (new) — colocated with the other practice-set integration tests for harness reuse.

**Intent**: Prove the reader is user-scoped and soft-delete-filtered (IDOR discipline) and that it maps rows.

**Contract**: Using `createFakeSupabase`: seed `practice_sets.select.data` with two raw rows and a known `userId`; call `listPracticeSetSummaries(fake.client, userId)`; assert `fake.calls.filters` contains `{ table: 'practice_sets', column: 'user_id', value: userId }` and `{ table: 'practice_sets', column: 'deleted_at', value: null }` (mirroring `idor.test.ts:129-140`); assert the returned `data` length and mapped fields. Add an error case: seed `practice_sets.select.error` → expect `{ ok: false }`. (Order/limit are not recorded by the fake; they are covered by code review + `astro check`.)

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run astro -- check`
- Tests pass: `npx vitest run`

#### Manual Verification:

- N/A.

---

## Phase 2: History page UI + dashboard entry point

### Overview

Build the SSR page that renders the list and empty state, and add a link from the dashboard.

### Changes Required:

#### 1. History page

**File**: `src/pages/app/sets/index.astro` (new)

**Intent**: Server-render the user's practice set history using `AppLayout`, reusing the auth/redirect and Supabase-client setup from sibling `/app` pages.

**Contract**:
- `export const prerender = false`. Read `Astro.locals.user`; redirect to `/login` if absent (matches `index.astro:9-13`).
- Build the Supabase client via `createSupabaseServerClient(Astro.request, Astro.cookies)`; call `listPracticeSetSummaries(supabase, user.id)`.
- Render inside `<AppLayout title="Your practice sets" description=... userEmail={display}>` (derive `display` as in `index.astro:15-16`).
- A "Back to dashboard" link to `/app` at top (reuse the link styling from `[id].astro:162-167`).
- When the reader returns `{ ok: false }`, render a small error card consistent with existing surfaces (no raw error text).
- **List state:** an `<ol>` of cards. Each card is an `<a href={\`/app/sets/${summary.id}\`}>` showing `title`, "Generated <localized date>" with the with-CV/from-JD-only suffix (mirror `[id].astro:172-174`), a status badge (`completed` vs `in_progress`), and the progress line (`{abcdAnswered}/15 multiple-choice answered · {openEndedChecked}/5 checked`, appending ` · score {abcdScorePercent}%` when non-null; when `contentReady === false`, show "Still preparing" instead of counts). Reuse the card/border token classes already used on `[id].astro` (`rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] …`).
- **Empty state:** when `data.length === 0`, render short copy ("You haven't generated any practice sets yet.") and a primary CTA `<a href="/app/generate" class="btn-primary …">Generate your first set</a>`.
- Format dates with `new Date(summary.createdAt).toLocaleString()` (matches `[id].astro:88`).

#### 2. Dashboard link into history

**File**: `src/pages/app/index.astro`

**Intent**: Give signed-in users a discoverable path to the new history page from the dashboard.

**Contract**: Below `<UsageDashboard …/>` inside `AppLayout`, add a small card/link to `/app/sets` labeled e.g. "Your practice sets" with one line of helper copy, using the existing card token classes and the brand-link styling. No data fetch added to the dashboard.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run astro -- check`
- Tests pass: `npx vitest run`
- Build passes: `npm run build`

#### Manual Verification:

- Signed-in user with ≥1 set sees them at `/app/sets`, newest first, with correct title/date/badge/progress; cards open `/app/sets/[id]`.
- A fully-completed set shows the `completed` badge and a score %; an in-progress set shows `in_progress` and partial counts.
- A brand-new account (no sets) sees the empty state and the "Generate your first set" CTA routes to `/app/generate`.
- The `/app` dashboard shows the "Your practice sets" link and it navigates to `/app/sets`.
- Visiting `/app/sets` while signed out redirects to `/login`.
- Light and dark themes both render the list readably (theme tokens).

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual walkthrough.

---

## Testing Strategy

### Unit Tests:

- `toPracticeSetSummary`: completed, in-progress, grandfathered-completed, and unparseable-content cases with inline-literal oracles.

### Integration Tests:

- `listPracticeSetSummaries`: asserts `user_id` + `deleted_at` scoping filters via `fake.calls.filters`, correct mapping of seeded rows, and `{ ok: false }` on a seeded read error.

### Manual Testing Steps:

1. Generate 2 sets; complete one fully, partially answer the other; open `/app/sets` and verify ordering, badges, and progress/score lines.
2. Click a card → lands on `/app/sets/[id]`; delete it there → return to `/app/sets` and confirm it's gone (soft-delete filtered).
3. On a fresh account, confirm the empty state + CTA to `/app/generate`.
4. Sign out, hit `/app/sets` directly → redirected to `/login`.
5. Toggle theme → list remains readable in both modes.

## Performance Considerations

The capped list (`limit 50`) hits the existing partial index `practice_sets_user_active_idx`. Per-row `parsePracticeSetWithProgress` runs at most 50× per page load — acceptable at PRD "small data volume." No N+1 (single query, no joins).

## Migration Notes

None — no schema change.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-09)
- PRD: `context/foundation/prd.md` (FR-008, US-01)
- Overview page (query + derivation + CTA model): `src/pages/app/sets/[id].astro`
- Dashboard page (auth + layout + result-object): `src/pages/app/index.astro`
- Data layer schema/index/RLS: `supabase/migrations/20260530110000_create_practice_sets.sql`
- Derivation helpers: `src/lib/practice/contracts.ts`, `src/lib/practice/score-abcd.ts`, `src/lib/practice/score-open-ended.ts`
- Test harness + IDOR discipline: `test/support/fake-supabase.ts`, `test/integration/api/practice-sets/idor.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: History data layer

#### Automated

- [ ] 1.1 Type checking passes: `npm run astro -- check`
- [ ] 1.2 Unit + scoping tests pass: `npx vitest run`
- [ ] 1.3 Build passes: `npm run build`

### Phase 2: History page UI + dashboard entry point

#### Automated

- [ ] 2.1 Type checking passes: `npm run astro -- check`
- [ ] 2.2 Tests pass: `npx vitest run`
- [ ] 2.3 Build passes: `npm run build`

#### Manual

- [ ] 2.4 History list renders correctly (order, badges, progress/score) and cards open `/app/sets/[id]`
- [ ] 2.5 Completed vs in-progress rows display correctly (badge + score %)
- [ ] 2.6 Empty state shows with a working "Generate your first set" CTA to `/app/generate`
- [ ] 2.7 Dashboard "Your practice sets" link navigates to `/app/sets`
- [ ] 2.8 Signed-out `/app/sets` redirects to `/login`
- [ ] 2.9 List readable in both light and dark themes
