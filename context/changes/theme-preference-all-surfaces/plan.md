# Theme Preference on All Surfaces Implementation Plan

## Overview

Switch PrepAhead from OS-only theming (`prefers-color-scheme`) to an explicit, user-controlled Light / Dark / System choice that:

- Applies instantly on **every** surface — landing, blog, login, 404, and the signed-in app (FR-022 / US-04).
- Renders with **no flash of the wrong theme** on first paint, including on the prerendered marketing/blog pages.
- **Persists to the signed-in account** and **restores across sessions and devices** (FR-023).

The data layer is already provisioned — `public.user_settings(theme)` exists with RLS, grants, and a signup bootstrap trigger — so **no migration is required**. The work is a CSS-strategy refactor, a small theme client library, an anti-FOUC inline script, one authenticated persistence endpoint, sign-in/cross-device cookie sync, and a reusable toggle control mounted in the two header components.

## Current State Analysis

- **Theming is OS-driven only.** `src/styles/global.css:14-47` defines light tokens on `:root` and dark tokens inside `@media (prefers-color-scheme: dark)`. There is **no `@custom-variant dark`**, so existing Tailwind `dark:` utilities (e.g. `src/pages/app/generate.astro:88`, `src/pages/login.astro:42`, `src/pages/blog/index.astro:118`) currently resolve against the OS, not a user choice.
- **No runtime theme code exists** — no toggle, no cookie/localStorage, no anti-FOUC script anywhere in the repo.
- **A single layout wraps everything.** `src/layouts/Layout.astro:22-42` emits `<html lang="en">` (no theme class/attribute) and is imported by the marketing/app/login/404 shells. It is the one place to inject the theme attribute + anti-FOUC script.
- **Render modes differ by surface.** No `output` is set in `astro.config.mjs`, so Astro defaults to static; pages opt into SSR with `export const prerender = false`. Landing (`src/pages/index.astro`) and blog (`src/pages/blog/index.astro:2`, `src/pages/blog/[slug].astro:8`) are **prerendered (static)**; `/app/*`, `/login`, and API routes are **SSR**. Consequence: the theme **cannot** be injected server-side on the static marketing/blog pages — an inline `<head>` script reading a client-readable cookie is the universal pre-paint mechanism.
- **Data layer is ready.** `supabase/migrations/20260528194500_create_core_tables.sql:42-72` defines `public.user_settings(user_id uuid pk, theme text check (theme is null or in ('light','dark','system')), updated_at)` with select/insert/update RLS scoped to `auth.uid()`, `grant select, insert, update ... to authenticated` (line 159), an `updated_at` trigger (lines 120-123), and a signup trigger that seeds a row with `theme = NULL` (lines 139-141). Nothing reads or writes it yet.
- **Auth header sink pattern is established.** Server reads go through `Astro.locals.user` (set in `src/middleware.ts:43`) + `createSupabaseServerClient(request, cookies, headers)` (`src/lib/supabase/server.ts:10`). Cookie token-refresh headers are merged onto responses via a `mergeHeaders` helper (`src/middleware.ts:15-19`).
- **Authenticated POST template.** `src/pages/api/practice-sets/[id]/save-answer.ts` is the canonical pattern: `prerender = false`, `getUser()` auth gate returning 401, `jsonResponse` (`src/lib/server/response.ts`), `mergeHeaders(responseHeaders, authHeaders)`, Supabase write scoped to `user.id`.
- **React island pattern.** Islands mount via `client:only="react"` (or `client:load`) with props passed from `.astro` (e.g. `src/pages/app/generate.astro:79-92`). `shadcn/ui is NOT installed` — the toggle is hand-rolled with Tailwind.
- **Two header homes.** Marketing/blog/404 use `src/components/landing/Header.astro` (404 imports it at `src/pages/404.astro:3`, blog at `src/pages/blog/index.astro:6`); the signed-in shell uses the header in `src/components/app/AppLayout.astro:19-41`. `login.astro` renders no header (it has its own centered card) — the toggle there is optional and out of scope for v1 (the inline script still themes it correctly).

## Desired End State

A user on any surface sees a theme control (Light / Dark / System). Selecting an option updates the UI immediately with no flash and writes a `theme` cookie. If they are signed in, the choice is also saved to `user_settings.theme` and restored on later visits and on other devices after sign-in. Both modes keep primary text and primary actions readable.

Verification: toggle on landing, blog, app; hard-reload shows no flash; sign out and back in preserves the choice; signing in on a second browser restores the saved theme; `npm run build`, `npm run astro -- check`, and lint all pass.

### Key Discoveries:

- `user_settings.theme` already exists with the exact `('light','dark','system')` constraint and full RLS — `supabase/migrations/20260528194500_create_core_tables.sql:42-72`. No migration.
- Static prerendering of marketing/blog (`src/pages/blog/index.astro:2`) forces a client-side, cookie-reading anti-FOUC script rather than server-side `<html>` injection.
- The toggle can POST to an authed endpoint on every surface (including static pages — the fetch carries cookies to an SSR endpoint); a 401 for anonymous users is expected and ignored, so no surface needs to know sign-in state at render time.
- The OAuth callback (`src/pages/api/auth/callback.ts`) already holds an authenticated Supabase client and the `cookies` object after `exchangeCodeForSession` — the natural single point to reconcile the account preference with any anonymous cookie and to seed the cookie from the DB (covers new-device restore, since a new device must sign in).

## What We're NOT Doing

- **No database migration** — `user_settings.theme` is already present.
- **No new color palette or pixel-perfect dark-mode audit.** The dark token set already exists; we re-point its trigger and smoke-check readability only (NFR: no unreadable primary actions in either mode). Per-component polish is out of scope.
- **No custom themes beyond Light/Dark/System** (PRD Non-Goals).
- **No test runner / unit tests** — the repo has none (AGENTS.md); verification stays build + check + lint + manual.
- **No theme toggle on the `/login` card** in v1 (the inline script still themes login correctly; adding a control there is optional polish).
- **No shadcn/ui installation** — the toggle is a hand-rolled Tailwind island.
- **No full no-JS `dark:` parity.** With `dark:` utilities keyed on the `.dark` class, a no-JS visitor still gets the CSS-variable token flip via the retained `@media (prefers-color-scheme: dark)` fallback, but the few `dark:` utility overrides (e.g. `dark:shadow-none`) won't apply. This is an accepted cosmetic-only degradation; achieving full parity would require duplicating those overrides under a media-query variant — not worth it.

## Implementation Approach

Cookie is the **client-readable application store**, read by an inline `<head>` script that resolves `system` via `matchMedia` and sets the resolved class on `<html>` before first paint — uniform across static and SSR pages. `user_settings.theme` is the **durable cross-device store** for signed-in users, synced to the cookie at sign-in (callback) and re-seeded in middleware when missing. The toggle applies optimistically (cookie + DOM) and persists best-effort to an authed endpoint; anonymous POSTs 401 harmlessly.

Three phases, each independently verifiable: (1) the CSS/cookie/FOUC mechanism with no UI, (2) the persistence + cross-device sync backend, (3) the toggle UI on all surfaces.

## Critical Implementation Details

- **Anti-FOUC + system resolution.** The inline script in `Layout.astro`'s `<head>` must run **before** `<body>` and resolve the effective theme so CSS never paints the wrong palette. It reads the `theme` cookie (`light` | `dark` | `system`; absent ⇒ `system`), resolves `system` against `window.matchMedia('(prefers-color-scheme: dark)')`, and applies the resolved value as a class on `document.documentElement`. Keep it tiny and dependency-free. Example shape (exact code is the implementer's to finalize):

```html
<script is:inline>
  (function () {
    try {
      var m = document.cookie.match(/(?:^|;\s*)theme=(light|dark|system)/);
      var pref = m ? m[1] : 'system';
      var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      var el = document.documentElement;
      el.classList.toggle('dark', dark);
      el.classList.toggle('light', !dark);
    } catch (e) {}
  })();
</script>
```

- **CSS selector strategy (Tailwind v4).** Add a `@custom-variant dark` so `dark:` utilities key off the `.dark` class instead of the OS, e.g. `@custom-variant dark (&:where(.dark, .dark *));`. Token blocks: light tokens stay on `:root`; dark tokens apply under `:root.dark`; the existing `@media (prefers-color-scheme: dark)` block is retained **only as a no-JS fallback**, scoped so it does not fight an explicit class (e.g. apply OS-dark tokens only when neither `.light` nor `.dark` is present). The inline script always sets an explicit class, so with JS the media query never wins.
- **`color-scheme` sync.** `:root` currently declares `color-scheme: light dark`. Set `color-scheme` per resolved theme (e.g. `:root.dark { color-scheme: dark; } :root.light { color-scheme: light; }`) so native form controls / scrollbars match.
- **Cookie attributes.** `theme` cookie: `Path=/`, ~1-year `Max-Age`, `SameSite=Lax`, not `HttpOnly` (the inline script and toggle must read/write it client-side). It is non-sensitive.
- **Anonymous persist is best-effort.** The toggle's `fetch` to the persistence endpoint must not block the UI and must swallow non-2xx (401 for anonymous is normal).

## Phase 1: Theme mechanism foundation

### Overview

Establish the explicit-theme mechanism with no UI: class-based CSS strategy, a shared theme client lib, and the anti-FOUC inline script. After this phase the theme is fully controllable by the `theme` cookie (default `system`) with zero flash.

### Changes Required:

#### 1. CSS dark-mode strategy

**File**: `src/styles/global.css`

**Intent**: Re-point dark styling from OS-only to an explicit `.dark` class on `<html>` while keeping an OS fallback for the no-JS case, so a user choice (not just the OS) drives the palette.

**Contract**: Add a Tailwind v4 `@custom-variant dark` keyed on `.dark`. Move the dark token values into `:root.dark`; keep light tokens on `:root`; retain the `@media (prefers-color-scheme: dark)` block scoped so it applies only when no explicit `.light`/`.dark` class is set. Add `color-scheme` per resolved class. Existing `dark:` utilities in components must continue to render correctly under the new variant.

#### 2. Shared theme client library

**File**: `src/lib/theme/client.ts` (new)

**Intent**: One module owning the theme contract (allowed values, cookie name) and the read/write/apply helpers shared by the inline script's logic, the toggle island, and any other client code — so the resolution rule lives in exactly one place.

**Contract**: Export the theme-value union/type (`'light' | 'dark' | 'system'`), the cookie name constant, a `readThemeCookie()`, a `writeThemeCookie(value)` (with the cookie attributes from Critical Implementation Details), a `resolveEffective(value)` (resolves `system` via `matchMedia`), and an `applyTheme(value)` that sets the `.dark`/`.light` class on `document.documentElement`. Also export a `watchSystem(onChange)` that subscribes to `matchMedia('(prefers-color-scheme: dark)')` `change` events and returns an unsubscribe function — used to keep the UI live while the active preference is `system` (the inline script only resolves once at load; the hydrated client owns live following). No DOM work at import time.

#### 3. Anti-FOUC inline script in the shared layout

**File**: `src/layouts/Layout.astro`

**Intent**: Apply the resolved theme to `<html>` before first paint on every surface (static and SSR) so there is no flash.

**Contract**: Add an `is:inline` `<script>` in `<head>` (before any content) implementing the resolution logic from Critical Implementation Details (read `theme` cookie → resolve `system` → set class). It must be self-contained inline JS (not an imported module) so it executes synchronously pre-paint; the canonical resolution rule still lives in `src/lib/theme/client.ts` for runtime code. Do **not** add a static `class="light"`/`class="dark"` placeholder on `<html>` — leave `<html>` class-free in source so the inline script is the only thing that ever sets a theme class. A static placeholder would always satisfy `.light`/`.dark` and thereby defeat the no-JS `@media (prefers-color-scheme: dark)` fallback (which only fires when no explicit class is present).

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Astro/type check passes: `npm run astro -- check`
- Lint passes (per `package.json` scripts)

#### Manual Verification:

- With no `theme` cookie, the site follows the OS preference (system default) on landing, blog, and `/app`.
- Manually setting `document.cookie = 'theme=dark; path=/'` and hard-reloading shows dark mode immediately with **no flash** on a prerendered page (blog) and an SSR page (`/app`).
- Setting `theme=light` while the OS is dark forces light mode (explicit class beats OS).
- Existing `dark:` utilities (e.g. login card shadow, blog cards) still render correctly under the chosen theme.

---

## Phase 2: Persistence & cross-device sync

### Overview

Make a signed-in user's choice durable and cross-device: an authenticated endpoint that upserts `user_settings.theme`, sign-in reconciliation in the OAuth callback, and a middleware re-seed of the cookie from the DB when it is missing on `/app/*`.

### Changes Required:

#### 1. Theme persistence endpoint

**File**: `src/pages/api/settings/theme.ts` (new)

**Intent**: Let a signed-in client save its theme choice to the account, mirroring the established authed-write pattern.

**Contract**: `export const prerender = false;` `POST` handler modeled on `src/pages/api/practice-sets/[id]/save-answer.ts`: create the Supabase server client with an auth-header sink, `getUser()` → 401 `jsonResponse` when absent, validate the JSON body `{ theme }` against `'light' | 'dark' | 'system'` (400 otherwise), then `upsert` into `public.user_settings` (`{ user_id: user.id, theme }`, conflict target `user_id`) so a missing row is created and an existing one updated. Return `jsonResponse({ ok: true }, { headers: responseHeaders })` with merged auth headers. Reuse the theme-value type from `src/lib/theme/client.ts` (or a shared server-safe constant).

#### 2. Sign-in reconciliation + cookie seed

**File**: `src/pages/api/auth/callback.ts`

**Intent**: At sign-in, decide the winning preference (account wins; seed from the anonymous cookie only when the account has none) and seed the `theme` cookie so the next render restores the saved theme — including on a new device.

**Contract**: After a successful `exchangeCodeForSession`, using the same authenticated client: read `user_settings.theme` for the user. If it is non-null, set the `theme` cookie to that value. If it is null and an anonymous `theme` cookie is present with an explicit value, persist that value to `user_settings` and keep the cookie. Use `cookies.set` with the standard cookie attributes. Must not block or fail the redirect on a settings read/write error (best-effort; log nothing sensitive). Preserve existing redirect/`next` behavior.

#### 3. Middleware cookie re-seed for the app

**File**: `src/middleware.ts`

**Intent**: Cover the case where a signed-in user has the session cookie but no `theme` cookie (e.g. cookie cleared) so the app surface still restores their saved theme — without adding a DB query to every request.

**Contract**: Within the existing `/app/*` authenticated branch, **only when** the request carries no `theme` cookie and `user` is present, read `user_settings.theme` and, if non-null, set the `theme` cookie on the response (via the existing header/cookie mechanism). Skip the query entirely when the cookie is already present. Do not affect non-`/app` paths or unauthenticated flows.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Astro/type check passes: `npm run astro -- check`
- Lint passes

#### Manual Verification:

- `POST /api/settings/theme` with `{ "theme": "dark" }` while signed in returns `{ ok: true }` and the `user_settings` row reflects `dark`; an invalid value returns 400; an unauthenticated call returns 401.
- Signing out and back in restores the saved theme (cookie seeded from DB in the callback).
- Signing in on a second browser/device with no prior cookie restores the account's saved theme.
- A signed-in user who clears only the `theme` cookie gets it re-seeded on the next `/app` page load.

---

## Phase 3: Theme toggle on all surfaces

### Overview

Add the user-facing control: a reusable three-way Light / Dark / System toggle island mounted in both header components, wired to apply optimistically and persist best-effort, plus a readability smoke-check in both modes across surfaces.

### Changes Required:

#### 1. Theme toggle island

**File**: `src/components/theme/ThemeToggle.tsx` (new)

**Intent**: A reusable control that lets the user pick Light / Dark / System, applies the choice instantly, and saves it to the account when signed in — identical on every surface.

**Contract**: A React island (hand-rolled Tailwind, no shadcn) exposing the three options (compact segmented control or cycling icon button) and reflecting the current selection read from the `theme` cookie via `src/lib/theme/client.ts`. On change: call `writeThemeCookie` + `applyTheme` immediately (optimistic), then best-effort `fetch('/api/settings/theme', { method: 'POST', body: { theme } })`, swallowing non-2xx (401 expected for anonymous). While the active preference is `system`, register `watchSystem` to re-apply the resolved theme on OS changes (and unsubscribe when the user picks an explicit light/dark, or on unmount) so criterion 3.5 holds. Initialize from the cookie on mount (render a stable default until mounted). Accessible: a labeled control with `aria` state; keyboard operable.

#### 2. Mount in the marketing/blog header

**File**: `src/components/landing/Header.astro`

**Intent**: Surface the toggle on landing, blog, and 404 (all render this header).

**Contract**: Mount `ThemeToggle` (e.g. `client:only="react"` with a small non-interactive fallback) in the header's right-hand control group (near the Pricing / Start free actions, lines 29-42), styled consistently with the existing header buttons. No change to nav semantics.

#### 3. Mount in the app header

**File**: `src/components/app/AppLayout.astro`

**Intent**: Surface the toggle in the signed-in shell.

**Contract**: Mount `ThemeToggle` in the header control group alongside the email + Sign out (lines 27-39), styled to match. The toggle persists to the account because the user is authenticated (the POST succeeds).

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Astro/type check passes: `npm run astro -- check`
- Lint passes

#### Manual Verification:

- The toggle is present and operable in the landing/blog header and the `/app` header; selecting Light / Dark / System updates the UI immediately on each.
- Choosing `System` follows the OS and updates live when the OS theme changes.
- An anonymous visitor's choice persists across reloads (cookie) with no console errors from the harmless 401.
- A signed-in user's toggle choice is saved to the account (verified via Phase 2 behavior) and survives sign-out/sign-in and a second device.
- Readability smoke-check: in both Light and Dark, primary text and primary actions (buttons, links, form controls) are readable on landing, blog index, a blog post, login, 404, `/app` dashboard, generate, practice, and open-ended screens (NFR: no unreadable primary actions in either mode).
- No flash of the wrong theme on hard reload of any surface.

---

## Testing Strategy

### Manual Testing Steps:

1. Clear cookies; load landing with OS in dark mode → site is dark (system default). Switch OS to light → live update.
2. Toggle to Dark on the landing header; hard-reload landing and a blog post → dark, no flash.
3. Toggle to Light while OS is dark on `/app` → forced light, no flash on reload.
4. Signed in: toggle to Dark, sign out, sign back in → restored to Dark.
5. Signed in on browser A set Dark; sign in on browser B (no prior cookie) → browser B restores Dark.
6. Signed in: clear only the `theme` cookie, reload `/app` → re-seeded to the saved theme.
7. Anonymous: toggle Dark, confirm a harmless 401 from `/api/settings/theme` and that the theme still applies and persists across reloads.
8. Readability pass across all surfaces in both modes.

## Performance Considerations

- The anti-FOUC inline script is a few lines and runs synchronously in `<head>`; negligible cost, and it prevents a flash.
- The middleware DB read is gated on the `theme` cookie being absent, so steady-state `/app` requests add no extra query.
- The persistence POST is best-effort and off the render path.

## Migration Notes

No schema migration. `user_settings` rows for existing users already exist (`theme = NULL`), which the system treats as `system`; the endpoint upserts to be safe for any missing row.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-06)
- PRD: FR-022, FR-023, US-04, NFR "Theme readability" — `context/foundation/prd.md`
- Schema: `supabase/migrations/20260528194500_create_core_tables.sql:42-72`
- Authed-write template: `src/pages/api/practice-sets/[id]/save-answer.ts`
- Shared layout: `src/layouts/Layout.astro`
- Header homes: `src/components/landing/Header.astro`, `src/components/app/AppLayout.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Theme mechanism foundation

#### Automated

- [x] 1.1 Build passes: `npm run build` — 7cfa638
- [x] 1.2 Astro/type check passes: `npm run astro -- check` — 7cfa638
- [x] 1.3 Lint passes — 7cfa638

#### Manual

- [x] 1.4 No-cookie site follows OS (system default) on landing, blog, `/app` — 7cfa638
- [x] 1.5 `theme=dark` cookie + hard reload shows dark with no flash on static (blog) and SSR (`/app`) pages — 7cfa638
- [x] 1.6 `theme=light` forces light over a dark OS — 7cfa638
- [x] 1.7 Existing `dark:` utilities still render correctly under the new variant — 7cfa638

### Phase 2: Persistence & cross-device sync

#### Automated

- [x] 2.1 Build passes: `npm run build` — 6bb89c0
- [x] 2.2 Astro/type check passes: `npm run astro -- check` — 6bb89c0
- [x] 2.3 Lint passes — 6bb89c0

#### Manual

- [x] 2.4 `POST /api/settings/theme` upserts the row when signed in; 400 on invalid; 401 when anonymous — 6bb89c0
- [x] 2.5 Sign-out then sign-in restores the saved theme (callback cookie seed) — 6bb89c0
- [x] 2.6 Sign-in on a second browser/device restores the account theme — 6bb89c0
- [x] 2.7 Clearing only the `theme` cookie re-seeds it on the next `/app` load — 6bb89c0

### Phase 3: Theme toggle on all surfaces

#### Automated

- [x] 3.1 Build passes: `npm run build` — d0b0b49
- [x] 3.2 Astro/type check passes: `npm run astro -- check` — d0b0b49
- [x] 3.3 Lint passes — d0b0b49

#### Manual

- [x] 3.4 Toggle present and operable in marketing/blog header and `/app` header; instant update on each — d0b0b49
- [x] 3.5 `System` follows the OS and updates live on OS theme change — d0b0b49
- [x] 3.6 Anonymous choice persists across reloads with no breaking console errors (401 harmless) — d0b0b49
- [x] 3.7 Signed-in toggle choice saves to the account and survives sign-out/sign-in and a second device — d0b0b49
- [x] 3.8 Readability smoke-check passes in both modes across all surfaces — d0b0b49
- [x] 3.9 No flash of the wrong theme on hard reload of any surface — d0b0b49
