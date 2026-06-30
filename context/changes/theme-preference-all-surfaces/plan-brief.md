# Theme Preference on All Surfaces — Plan Brief

> Full plan: `context/changes/theme-preference-all-surfaces/plan.md`

## What & Why

Let a user switch Light / Dark / System on every PrepAhead surface (landing, blog, login, 404, signed-in app), apply it instantly with no flash, and persist the choice to their account so it survives sign-out/sign-in and follows them across devices. Today theming is OS-only (`prefers-color-scheme`) with no control and no persistence — this delivers FR-022, FR-023, and US-04.

## Starting Point

The data layer is already done: `public.user_settings(theme)` exists with the `('light','dark','system')` constraint, RLS, grants, and a signup trigger — but **nothing reads or writes it**. There is zero runtime theme code (no toggle, cookie, or anti-FOUC script), and dark styling lives only inside `@media (prefers-color-scheme: dark)` in `global.css` with no `@custom-variant dark`.

## Desired End State

A theme control in both header components lets users pick Light / Dark / System. The choice applies before first paint (no flash) on both static and SSR pages, is stored in a cookie for the device, and — when signed in — saved to `user_settings` and restored on later visits and other devices after sign-in. Both modes keep primary text and actions readable.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Storage / FOUC strategy | Cookie as client-read application store + `user_settings` as durable cross-device store | Cookie is readable pre-paint by an inline script on static pages too; DB gives cross-device persistence | Plan |
| Apply mechanism | Inline `<head>` script reading the cookie, resolving `system` via `matchMedia` | Marketing/blog are prerendered/static, so server-side `<html>` injection is impossible | Plan |
| First-visit default | `system` (match OS) | Least surprising; matches current behavior and the value the signup trigger seeds | Plan |
| Control type | Three-way Light / Dark / System | Coherent with a `system` default and the existing DB check constraint; lets users return to OS-follow | Plan |
| Anonymous → account reconciliation | Account wins; seed from the anonymous cookie only if the account is unset | Cross-device consistency for returning users while honoring a brand-new user's pre-sign-in pick | Plan |
| Toggle placement | Compact control in both header components (landing/blog + app) | One reusable control, consistent top-right, covers all surfaces | Plan |
| Visual scope | Wire mechanism + smoke-check readability; no per-component dark audit | The dark palette already exists; this is mostly re-pointing the CSS trigger | Plan |
| Save-failure handling | Optimistic apply + best-effort persist (401/errors swallowed) | Theme is non-critical; the cookie still persists locally | Plan |
| Verification depth | Build + `astro check` + lint + manual | Repo has no test runner (AGENTS.md) | Plan |

## Scope

**In scope:** class-based CSS dark strategy + `@custom-variant dark`; shared theme client lib; anti-FOUC inline script in `Layout.astro`; `POST /api/settings/theme`; sign-in reconciliation in the OAuth callback; middleware cookie re-seed on `/app/*`; reusable three-way toggle in both headers; readability smoke-check.

**Out of scope:** DB migration (already present); new palette / pixel-perfect dark audit; custom themes beyond Light/Dark/System; test runner / unit tests; a toggle on the `/login` card; shadcn/ui.

## Architecture / Approach

The `theme` cookie (`light`|`dark`|`system`) is applied before paint by an inline `<head>` script that resolves `system` via `matchMedia` and sets `.dark`/`.light` on `<html>`; `global.css` keys `dark:` utilities and dark tokens off that class (OS media query kept as a no-JS fallback). The toggle applies optimistically (cookie + DOM) then POSTs best-effort to an SSR endpoint that upserts `user_settings.theme`; anonymous POSTs 401 harmlessly, so no surface needs render-time sign-in knowledge. Cross-device restore is seeded from the DB into the cookie at the OAuth callback (a new device must sign in) and re-seeded in middleware on `/app/*` when the cookie is missing.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Theme mechanism foundation | Class-based CSS + shared theme lib + anti-FOUC script; cookie-driven theming, no UI | FOUC if the inline script isn't truly pre-paint; `dark:` utilities regressing under the new variant |
| 2. Persistence & cross-device sync | `POST /api/settings/theme`, callback reconciliation, middleware re-seed | Reconciliation/cookie-seed edge cases; avoiding per-request DB cost |
| 3. Theme toggle on all surfaces | Reusable three-way toggle in both headers + readability smoke-check | Hydration mismatch on the island; an unreadable control slipping through in one mode |

**Prerequisites:** S-01 (done). No migration; `user_settings` ready. `OPENAI_API_KEY` etc. unaffected.
**Estimated effort:** ~1–2 sessions across 3 phases (small, contained slice).

## Open Risks & Assumptions

- The inline-script anti-FOUC approach assumes JS-enabled clients for explicit choices; no-JS users fall back to the OS media query (acceptable).
- `login.astro` has no header, so it gets no toggle in v1 (still themed correctly by the script).
- Cross-device restore on marketing pages relies on the cookie being seeded at sign-in; a signed-in user landing on marketing on a brand-new device before signing in sees the system default until they sign in.

## Success Criteria (Summary)

- Toggle works on landing, blog, and app; instant update; no flash on hard reload of static or SSR pages.
- A signed-in user's choice persists across sign-out/sign-in and across devices.
- Both Light and Dark keep primary text and actions readable on every surface.
