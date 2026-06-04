# Supabase OAuth Auth Implementation Plan

## Overview

Implement **F-03** from `context/foundation/roadmap.md`: wire **Google OAuth** via Supabase Auth into PrepAhead’s Astro app. Deliver SSR session cookies (`@supabase/ssr`), auth API routes, Astro middleware protection for `/app/*`, a `/login` entry point, and manual verification that F-02’s `handle_new_user` trigger and RLS policies work with real user JWTs.

This plan intentionally focuses on **identity + session + route gate** — not the usage dashboard (S-01), practice UI, or billing.

## Current State Analysis

| Area | State | Evidence |
| --- | --- | --- |
| Supabase SDK | Not installed | `package.json` — no `@supabase/*` |
| Auth routes | Absent | Only `src/pages/api/health.ts` |
| Middleware | Absent | No `src/middleware.ts` |
| Protected pages | Absent | Only public `src/pages/index.astro` |
| Login UI | Placeholder | `src/components/landing/Cta.astro` — disabled “Sign in coming soon” |
| Env var names | Defined | `.env.example`, `src/lib/server/env.ts` |
| DB auth bootstrap | Ready | `handle_new_user()` trigger in `supabase/migrations/20260528194500_create_core_tables.sql` |
| RLS | Ready | All app tables scoped to `auth.uid()` |
| Server API pattern | Established | F-01: `APIRoute`, `prerender = false`, `src/lib/server/` helpers |

### Key Discoveries

- F-01 established on-demand API routes with `export const prerender = false`; auth callbacks must follow the same pattern.
- F-02 defers JWT-based RLS proof to F-03; usage RPCs expect **`auth.uid()` from the user’s JWT**, not service role.
- With Astro 6 default **static** output, middleware runs at **request time only for on-demand routes** — `/app/**` pages must set `prerender = false` (or use Vercel `middlewareMode: 'edge'`). This plan uses **`prerender = false` on `/app/**`** to keep marketing static.
- `supabase/config.toml` `[auth]` has `site_url = "http://127.0.0.1:3000"` — local OAuth uses **hosted Supabase** per planning decision; do not rely on local stack redirect URLs for Google OAuth dev.
- Server env access must stay **static** via `requireEnv()` — no dynamic `import.meta.env[key]`.

## Desired End State

After this plan:

1. **`@supabase/ssr`** and **`@supabase/supabase-js`** are installed; shared client factories exist under `src/lib/supabase/`.
2. **Auth API routes** handle Google OAuth sign-in, callback (PKCE code exchange), and sign-out — all `prerender = false`.
3. **`src/middleware.ts`** refreshes the session via `supabase.auth.getUser()` and attaches `user` to `Astro.locals`.
4. **`/app/**`** is protected: unauthenticated users redirect to `/login?next=<safe-path>`.
5. **`/login`** offers “Continue with Google”; landing CTA links to `/login`.
6. **`/app`** shows a minimal signed-in stub (email or user id) and a sign-out control.
7. **First OAuth sign-in** creates `profiles` + `user_settings` via the existing DB trigger (no app-side profile insert).
8. **Manual verification** confirms OAuth E2E on Vercel Preview and RLS blocks cross-user reads.
9. **Docs** list required Supabase redirect URLs and Vercel env vars for OAuth.

### Verification commands

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- `npm run preview` then curl auth routes (sign-in redirect, health still 200)
- Vercel Preview: complete Google sign-in → land on `/app`
- Manual: two test users — user A cannot `select` user B’s `profiles` row via authenticated client

## What We're NOT Doing

- Usage dashboard or quota display (S-01)
- Practice set generation, Check, or billing routes
- Additional OAuth providers (GitHub, Apple, etc.)
- shadcn/ui sign-in components (minimal Astro/HTML is sufficient for F-03)
- `src/middleware.ts` gating blog or marketing pages
- Service-role Supabase client for normal user reads/writes
- Automated integration test harness (no test runner in repo)
- Blog CTA to sign-in (S-08 parallel track)
- Local Supabase stack Google OAuth configuration (hosted project for OAuth dev)
- Enabling `middlewareMode: 'edge'` unless `prerender = false` on `/app/**` proves insufficient
- Full usage dashboard at `/app` (S-01 replaces stub content; route and post-login redirect exist in F-03)

## Implementation Approach

Follow F-01’s **`APIRoute` + `prerender = false`** convention for all auth endpoints. Centralize `@supabase/ssr` cookie wiring in **`src/lib/supabase/server.ts`** so middleware and API routes share one factory. Use **`getUser()`** (not `getSession()`) for server-side auth checks. Keep marketing pages static; mark **`/app/**` as on-demand** so middleware executes at request time. OAuth redirect target: **`${PUBLIC_SITE_URL}/api/auth/callback`**. Post-login default: **`/app`**, with optional **`?next=`** limited to same-origin relative paths.

## Critical Implementation Details

**Middleware + static output:** Prerendered pages skip request-time middleware. All files under `src/pages/app/` must export `export const prerender = false`. Middleware checks `context.url.pathname.startsWith('/app')` and redirects to `/login?next=…` when `locals.user` is null.

**Safe `?next=` validation:** Accept only paths starting with `/` that do not start with `//` (block protocol-relative open redirects). Reject absolute URLs. Default to `/app` when missing or invalid.

**Supabase redirect URLs:** Dashboard → Authentication → URL Configuration must include `${PUBLIC_SITE_URL}/api/auth/callback` for each environment (Production, Preview, local dev with hosted Supabase). Mismatch is the most common OAuth failure.

**Vercel Preview origins:** Browsing a Preview at `https://<project>-<hash>.vercel.app` while `PUBLIC_SITE_URL` points at Production breaks OAuth. Mitigations (pick one, document in deploy-plan): (a) Supabase Redirect URL wildcard `https://*.vercel.app/**` plus Preview-scoped `PUBLIC_SITE_URL` in Vercel Preview env, or (b) runtime site URL from `VERCEL_URL` when set, falling back to `PUBLIC_SITE_URL` for Production.

**Do not log** OAuth codes, tokens, or session payloads (`AGENTS.md`).

**`setAll` cache headers:** `@supabase/ssr` passes cache-control headers as the second argument to `setAll(cookiesToSet, headers)` on token refresh. Forward these via `context.response.headers.set` in middleware and on auth API route responses — omitting them can cause CDN/browser session leakage on Vercel.

## Phase 1: Dependencies & Supabase clients

### Overview

Install Supabase packages and add typed, reusable client factories for server (middleware, API routes, on-demand pages) and browser (future React islands).

### Changes Required:

#### 1. Install Supabase packages

**File**: `package.json` / `package-lock.json`

**Intent**: Add the official Supabase SSR and JS clients required for OAuth cookie handling.

**Contract**: Dependencies include `@supabase/ssr` and `@supabase/supabase-js` at current stable versions. No other auth libraries.

#### 2. Server Supabase client factory

**File**: `src/lib/supabase/server.ts` (new)

**Intent**: Single place to create a per-request Supabase server client with correct cookie read/write for Astro middleware and API routes.

**Contract**: Export a factory (e.g. `createSupabaseServerClient`) accepting Astro’s cookie context (`cookies` from `APIRoute`/`Middleware`, or equivalent from middleware `context.cookies`) and optional response header sink (middleware `context.response.headers` or API route response). Use `createServerClient` from `@supabase/ssr` with `parseCookieHeader` for reads and `setAll` forwarding to Astro `cookies.set` **and** applying the `headers` argument from `setAll` to the response header sink. Use `requireEnv('PUBLIC_SUPABASE_URL')` and `requireEnv('PUBLIC_SUPABASE_ANON_KEY')`. **New instance per request** — no module-level singleton.

#### 3. Browser Supabase client factory (minimal)

**File**: `src/lib/supabase/browser.ts` (new)

**Intent**: Optional thin wrapper for future React islands; establish the client-only boundary now.

**Contract**: Export `createBrowserClient` wrapper using public env vars only. No service role key. May be unused in F-03 UI if sign-in is form-based — file still documents the pattern.

#### 4. Astro locals typing

**File**: `src/env.d.ts` (create or extend)

**Intent**: Type `Astro.locals.user` and optional `Astro.locals.supabase` for middleware consumers.

**Contract**: Extend `App.Locals` with `user: import('@supabase/supabase-js').User | null` (or equivalent). Ensure `npm run astro -- check` passes after middleware lands in Phase 3.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- `package.json` lists `@supabase/ssr` and `@supabase/supabase-js`

#### Manual Verification:

- Import paths resolve; no service role key referenced in `src/lib/supabase/`

**Implementation Note**: Pause after automated checks before Phase 2.

---

## Phase 2: Auth API routes & OAuth flow

### Overview

Implement the Google OAuth lifecycle: initiate sign-in, exchange authorization code for session, sign out. Support safe post-auth redirect via `?next=`.

### Changes Required:

#### 1. Sign-in route

**File**: `src/pages/api/auth/sign-in.ts` (new)

**Intent**: Start Google OAuth via Supabase; set PKCE cookies; redirect browser to Google.

**Contract**:

- `export const prerender = false`
- `POST` handler (form POST from `/login` is acceptable)
- Uses server Supabase client factory
- Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${requireEnv('PUBLIC_SITE_URL')}/api/auth/callback` } })`
- Optional: accept `next` form field; store in a short-lived httpOnly cookie `oauth_next` (required when `next` is present on sign-in or when middleware redirected with `?next=`)
- On success: redirect to Supabase/Google URL; on failure: redirect to `/login?error=…`

#### 2. OAuth callback route

**File**: `src/pages/api/auth/callback.ts` (new)

**Intent**: Exchange `?code=` for a session; set auth cookies; redirect to app.

**Contract**:

- `export const prerender = false`
- `GET` handler
- Read `code` from query; handle `error` query param from provider
- `supabase.auth.exchangeCodeForSession(code)`
- Resolve post-auth path: read and clear `oauth_next` cookie, else validate `next` query param via shared validator → default `/app`
- Redirect to resolved path on success; `/login?error=…` on failure
- Do not log `code` or tokens

#### 3. Sign-out route

**File**: `src/pages/api/auth/sign-out.ts` (new)

**Intent**: Clear Supabase session cookies and return user to public entry.

**Contract**:

- `export const prerender = false`
- `POST` handler
- `supabase.auth.signOut()`
- Redirect to `/login` (or `/` — pick `/login` for consistency)

#### 4. Shared redirect helper

**File**: `src/lib/server/auth-redirect.ts` (new)

**Intent**: Centralize safe `?next=` path validation used by sign-in, callback, and middleware.

**Contract**: Export function that returns `/app` for invalid input; accepts only relative paths starting with `/` and not `//`. Used when setting `oauth_next` cookie and when resolving post-auth redirect in callback.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- `npm run preview`: POST to `/api/auth/sign-in` (with env vars set) returns redirect to Google/Supabase (302/303)
- Callback route returns redirect response (cannot fully test without real OAuth code)
- `/api/health` still returns 200

**Implementation Note**: Full OAuth E2E requires hosted Supabase + Google credentials — complete in Phase 4 on Preview.

---

## Phase 3: Middleware, protected routes & sign-in UI

### Overview

Add session-aware middleware, protect `/app/*`, ship `/login` and a signed-in stub, wire the landing CTA.

### Changes Required:

#### 1. Astro middleware

**File**: `src/middleware.ts` (new)

**Intent**: Refresh session on each request; expose user to pages and API routes; gate `/app/*`.

**Contract**:

- `defineMiddleware` from `astro:middleware`
- Create server Supabase client per request
- Call `supabase.auth.getUser()` (not `getSession()` alone)
- Set `context.locals.user = user ?? null`
- If `pathname.startsWith('/app')` and no user → redirect to `/login?next=<encoded-path>`
- If `pathname === '/login'` and user exists → redirect to `/app`
- Exclude: `/api/auth/*`, static assets, public marketing routes (except `/login` gate above)
- Do not gate `/api/health`

#### 2. Protected app stub

**File**: `src/pages/app/index.astro` (new)

**Intent**: Minimal signed-in destination proving middleware + session work; S-01 replaces content.

**Contract**:

- `export const prerender = false`
- Uses shared layout (`src/layouts/Layout.astro` or new app layout)
- Reads `Astro.locals.user` — show non-sensitive identifier (email or truncated id)
- Sign-out form POSTing to `/api/auth/sign-out`
- Copy indicates “Signed in — dashboard coming in S-01” or equivalent

#### 3. Login page

**File**: `src/pages/login.astro` (new)

**Intent**: FR-001 entry point for Google OAuth.

**Contract**:

- **`export const prerender = false`** — middleware must run at request time to redirect already-signed-in users to `/app` and to support future server-side login state
- “Continue with Google” via `<form method="POST" action="/api/auth/sign-in">` (hidden `next` from query string when present)
- Display friendly error when `?error=` present
- Link back to `/`
- Uses existing layout and Tailwind tokens from `global.css`

#### 4. Landing CTA update

**File**: `src/components/landing/Cta.astro`

**Intent**: Replace disabled placeholder with real sign-in link.

**Contract**: Change disabled span to `<a href="/login">` styled as primary CTA (e.g. “Sign in to get started”).

#### 5. Header sign-in link (optional)

**File**: `src/components/landing/Header.astro`

**Intent**: Secondary entry to sign-in from nav.

**Contract**: Add link to `/login` if header exists and fits existing nav pattern — skip if redundant with CTA.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- Build output shows on-demand route for `/app` (not fully static)

#### Manual Verification:

- Unauthenticated visit to `/app` redirects to `/login?next=/app`
- `/login` renders Google sign-in form
- Landing CTA navigates to `/login`

**Implementation Note**: Pause for manual OAuth confirmation on Preview before Phase 4 sign-off. Post-OAuth `/app` stub and sign-out are verified in Phase 4 (4.3, 4.6).

---

## Phase 4: Docs, env & verification

### Overview

Document OAuth setup for contributors and Vercel; run manual E2E and RLS cross-user proof; update deploy notes.

### Changes Required:

#### 1. Environment template notes

**File**: `.env.example`

**Intent**: Clarify OAuth-related vars and hosted-Supabase dev workflow.

**Contract**: Add comments that `PUBLIC_SITE_URL` must match the browser origin used for OAuth (e.g. `http://localhost:4321` local, Preview deployment URL for PR testing — or use `VERCEL_URL` runtime fallback documented in deploy-plan). Note Google OAuth is configured in **Supabase dashboard**, not in repo secrets. Note Supabase Redirect URLs should include a Vercel Preview wildcard (`https://*.vercel.app/**`) unless using per-Preview allowlist. No real values.

#### 2. Deploy plan OAuth section

**File**: `context/deployment/deploy-plan.md`

**Intent**: Record redirect URL requirements and Preview verification steps for auth.

**Contract**: Short subsection under verification or env: Supabase redirect URLs must include `https://prepahead.dev/api/auth/callback`, local dev URL, and a **Vercel Preview wildcard** (`https://*.vercel.app/**`) or per-Preview allowlist; document Preview `PUBLIC_SITE_URL` strategy (Preview-scoped env var or `VERCEL_URL` runtime fallback). F-03 smoke = sign-in → `/app`. Cross-link `.env.example`.

#### 3. Supabase OAuth setup checklist (in plan or README snippet)

**File**: `context/changes/supabase-oauth-auth/plan.md` (Testing Strategy) — operational steps for human

**Intent**: Single checklist for dashboard configuration.

**Contract**: Steps cover: enable Google provider in Supabase; Google Cloud OAuth client; authorized redirect URIs include Supabase callback URL; Supabase “Redirect URLs” include app callback paths; Vercel env vars for Preview + Production.

#### 4. Optional AGENTS.md one-liner

**File**: `AGENTS.md`

**Intent**: Point agents at auth route locations.

**Contract**: Note auth routes under `src/pages/api/auth/` and middleware gate on `/app/*`. Only add if not redundant with deploy-plan.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- **OAuth E2E on Vercel Preview:** `/login` → Google → `/app` with session
- **Profile bootstrap:** After first sign-in, `profiles` and `user_settings` rows exist for `auth.users.id` (Supabase Studio or SQL)
- **RLS cross-user:** As user A (JWT/session), attempt to read user B’s `profiles` row — denied
- **Sign-out:** Session cleared; `/app` redirects to login
- **`?next=` safety:** External URL in `next` does not redirect off-site

**Implementation Note**: Mark `change.md` `status: implemented` only after Preview OAuth + RLS proof pass (human confirmation).

#### 5. Supporting files (addendum — not in original phase scope)

**Files**: `astro.config.mjs`, `scripts/preview.mjs`

**Intent**: Stable local OAuth origin and on-demand route preview for manual verification.

**Contract**: `astro.config.mjs` pins `server.port: 4321`, `host: true`, and `strictPort: true` so `PUBLIC_SITE_URL=http://localhost:4321` matches the dev/preview origin used in Supabase redirect URLs. `scripts/preview.mjs` (invoked by `npm run preview`) routes `/api/*`, `/app`, and `/login` to the Vercel server bundle so auth middleware and API routes behave like production during local smoke tests.

---

## Testing Strategy

### Unit Tests

Out of scope — no test runner in repo.

### Integration Tests

Manual only for F-03:

1. Preview deploy with Supabase + Google configured
2. Full sign-in flow
3. RLS negative test with two accounts

### Manual Testing Steps

1. Set `.env.local`: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL=http://localhost:4321`
2. `npm run build && npm run astro -- check`
3. `npm run preview` — verify `/login`, `/app` redirect, `/api/health`
4. Configure Supabase Google provider + redirect URLs
5. Open PR to `prod`; test OAuth on Preview URL (update `PUBLIC_SITE_URL` or Supabase allowlist for Preview origin)
6. Sign in as User A — confirm `/app` stub and DB rows
7. Sign in as User B in separate browser/profile — **RLS cross-user proof (canonical):** in Supabase Studio → Authentication, copy User A's JWT; run `select * from profiles where id = '<user-b-uuid>'` (or REST GET with `Authorization: Bearer <jwt-a>`) — expect empty/denied. Repeat with User B's JWT against User A's row.
8. Sign out — confirm redirect and `/app` blocked

### RLS verification (F-03 canonical proof)

| Check | Method |
| --- | --- |
| OAuth sign-in → session cookies | Browser devtools / Preview |
| `handle_new_user` creates rows | Supabase Studio after first login |
| `auth.uid()` blocks other user’s rows | Two test Google accounts + Studio JWT SQL select against other user’s `profiles.id` |

## Performance Considerations

- Middleware `getUser()` adds one Supabase Auth round-trip per on-demand request to `/app/**` and auth API routes — acceptable for MVP.
- Keep marketing (`/`, landing sections) static to avoid unnecessary function invocations. `/login` and `/app/**` are on-demand for middleware auth checks.

## Migration Notes

- No database migration required — F-02 schema is ready.
- Supabase Auth config (Google provider, redirect URLs) is dashboard-side; document changes, do not commit secrets.
- Rolling back: remove middleware, auth routes, and Supabase packages; revert CTA. Session cookies expire naturally.

## References

- Roadmap: `context/foundation/roadmap.md` — F-03
- PRD: `context/foundation/prd.md` — FR-001, Access Control
- F-01 plan: `context/changes/server-api-foundation/plan.md`
- F-02 plan: `context/changes/supabase-data-schema/plan.md`
- Auth trigger: `supabase/migrations/20260528194500_create_core_tables.sql:129-152`
- Server env: `src/lib/server/env.ts`
- Deploy: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Dependencies & Supabase clients

#### Automated

- [x] 1.1 `npm run build` — exit 0 — 1ad5caa
- [x] 1.2 `npm run astro -- check` — exit 0 — 1ad5caa
- [x] 1.3 `package.json` lists `@supabase/ssr` and `@supabase/supabase-js` — 1ad5caa

#### Manual

- [x] 1.4 No service role key in `src/lib/supabase/` client factories — 1ad5caa

### Phase 2: Auth API routes & OAuth flow

#### Automated

- [x] 2.1 `npm run build` — exit 0 — 58ab2a7
- [x] 2.2 `npm run astro -- check` — exit 0 — 58ab2a7

#### Manual

- [x] 2.3 POST `/api/auth/sign-in` returns OAuth redirect when env configured — 58ab2a7
- [x] 2.4 `/api/health` still returns 200 — 58ab2a7
- [x] 2.5 Callback route returns redirect response (smoke without real code) — 58ab2a7

### Phase 3: Middleware, protected routes & sign-in UI

#### Automated

- [x] 3.1 `npm run build` — exit 0 — 8a2701b
- [x] 3.2 `npm run astro -- check` — exit 0 — 8a2701b
- [x] 3.3 Build output includes on-demand `/app` route — 8a2701b

#### Manual

- [x] 3.4 Unauthenticated `/app` redirects to `/login?next=/app` — 8a2701b
- [x] 3.5 `/login` renders Google sign-in; landing CTA links to `/login` — 8a2701b

### Phase 4: Docs, env & verification

#### Automated

- [x] 4.1 `npm run build` — exit 0
- [x] 4.2 `npm run astro -- check` — exit 0

#### Manual

- [x] 4.3 Preview OAuth E2E: sign-in → `/app`
- [x] 4.4 Profile + settings rows created on first sign-in
- [x] 4.5 RLS blocks cross-user read (two test accounts)
- [x] 4.6 Sign-out clears session; `?next=` cannot open external redirect
