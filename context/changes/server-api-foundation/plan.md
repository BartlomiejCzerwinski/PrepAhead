# Server API foundation Implementation Plan

## Overview

Enable Astro **static** output (default) with **on-demand** API routes on Vercel and a **60-second** serverless timeout, add a production-verifiable **`GET /api/health`** endpoint, introduce minimal **`src/lib/server`** helpers for future routes, and document environment variable names in **`.env.example`**. This implements roadmap **F-01** (`server-api-foundation`) so later changes can add auth callbacks, AI generation, and Stripe webhooks without reworking deploy configuration.

## Current State Analysis

| Area | State | Evidence |
| --- | --- | --- |
| Astro output | Static (default) | `astro.config.mjs` — no `output` key |
| Vercel adapter | Present, no options | `adapter: vercel()` at `astro.config.mjs:16` |
| API routes | Absent | No `src/pages/api/` |
| Middleware | Absent | No `src/middleware.ts` |
| Env template | Absent | No `.env.example` in repo |
| Deploy docs | Static scope | `context/deployment/deploy-plan.md:19` |

### Key Discoveries

- `AGENTS.md` requires AI, billing webhooks, OAuth, and metering in Astro server routes only — client bundles must not import provider secrets.
- `deploy-plan.md` explicitly defers `output: 'server'|'hybrid'`, `maxDuration: 60`, and `src/pages/api/` until MVP — this change closes that gap for the foundation slice only.
- `infrastructure.md` pre-mortem: misconfigured `maxDuration` and monolithic server bundles are common failure modes; health-only surface keeps F-01 small.

## Desired End State

After this plan:

1. **`astro.config.mjs`** keeps default `output: 'static'` (omit the key) and sets `adapter: vercel({ maxDuration: 60 })`.
2. **`GET /api/health`** returns `200` with JSON body `{ "ok": true }` (optional ISO `timestamp` field allowed). No authentication, no secrets, no JD/CV handling.
3. **`src/lib/server/`** exports small helpers used by `health.ts` and documented for copy-paste into future routes (`jsonResponse`, `requireEnv` or equivalent guard that throws/returns 500 when a required server env is missing).
4. **`.env.example`** lists placeholder names for Supabase, Stripe, model API, and public site URL — values empty, comments mark server-only vs public.
5. **`deploy-plan.md`** describes hybrid output and documents `/api/health` as the verification route.
6. **Vercel Preview** on a PR to `prod` serves `/api/health` successfully.

### Verification commands

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- Preview URL: `curl -sS https://<preview-host>/api/health` → HTTP 200, `"ok":true`

## What We're NOT Doing

- Installing or calling Supabase, Stripe, or OpenAI API SDKs
- Implementing OAuth callbacks, session cookies, or route protection (F-03)
- Generation, Check, or quota enforcement endpoints (S-02, S-04)
- Stripe checkout or webhook handlers (S-05)
- `src/middleware.ts` auth gate
- Structured logging, Sentry, or analytics
- Adding a test runner or GitHub Actions workflow
- Changing landing page content or blog routes

## Implementation Approach

Use Astro **`APIRoute`** handlers under **`src/pages/api/`**. With default static output, existing `.astro` pages remain prerendered; each API file exports **`export const prerender = false`** for on-demand server rendering. Shared response/env utilities live in **`src/lib/server/`** so F-03/S-02/S-05 add files without duplicating boilerplate. Secrets stay in **`import.meta.env`** (Vercel-scoped); health route must not read or echo secret values.

## Critical Implementation Details

**On-demand API default:** Without `export const prerender = false` on API files, Astro prerenders `/api/health` at build time as static JSON — Preview would not exercise Vercel Functions and the smoke test would not validate the server path. Every new `src/pages/api/*.ts` file must include that export until a project-wide API convention is added later.

**Do not log request bodies** on future routes; for F-01, health has no body — establish the pattern that handlers avoid logging sensitive payloads (`AGENTS.md`).

## Phase 1: Config & adapter

### Overview

Configure the Vercel adapter for 60s function duration (keep default static output). Confirm the existing landing still builds before API routes land in Phase 2.

### Changes Required:

#### 1. Astro config

**File**: `astro.config.mjs`

**Intent**: Enable serverless API routes while keeping static prerender for pages.

**Contract**: Do **not** set `output: 'hybrid'` (removed in Astro 6). Omit `output` or set `output: 'static'`. Replace `adapter: vercel()` with `adapter: vercel({ maxDuration: 60 })`. Keep existing `integrations` and `vite.plugins` unchanged.

#### 2. TypeScript env typings (if missing)

**File**: `src/env.d.ts` (create only if Astro env reference is not already covered)

**Intent**: Allow `import.meta.env` access in `.ts` API routes without type errors.

**Contract**: Extend Astro’s `ImportMetaEnv` interface with optional string keys matching `.env.example` names (no runtime values). **Add only if** `npm run astro -- check` fails after Phase 2; `tsconfig.json` already includes `.astro/types.d.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run build` completes with exit code 0
- `npm run astro -- check` completes with exit code 0
- Build succeeds with updated adapter; no config validation errors (Astro 6 rejects `output: 'hybrid'`)

#### Manual Verification:

- `npm run preview` serves the landing page at `/` without regression (layout, styles load)
- Local `curl http://localhost:4321/` still returns the marketing page (API route lands in Phase 2)

**Implementation Note**: Pause after Phase 1 automated checks pass and confirm manual landing smoke before Phase 2.

---

## Phase 2: API pattern

### Overview

Add the health endpoint and minimal server utilities that downstream API routes will reuse.

### Changes Required:

#### 1. JSON response helper

**File**: `src/lib/server/response.ts`

**Intent**: One consistent way to return JSON from API routes with correct `Content-Type`.

**Contract**: Export `jsonResponse(body: unknown, init?: ResponseInit): Response` that sets `Content-Type: application/json` and `JSON.stringify`s the body. Default status 200 unless `init.status` provided.

#### 2. Environment guard helper

**File**: `src/lib/server/env.ts`

**Intent**: Centralize “required server env missing” handling for future routes; health may not use it yet.

**Contract**: Export `requireEnv(name: EnvKey): string` where `EnvKey` is a union of known server env names from `.env.example` (e.g. `'OPENAI_API_KEY' | 'STRIPE_SECRET_KEY' | …`). Implementation must use **static** `import.meta.env.<KEY>` access per key (switch or explicit branches) — not dynamic `import.meta.env[name]`, which Vite does not inline and breaks on Vercel. Throw or return 500 when missing. Document: server-only vars must not use `PUBLIC_` unless intentionally client-safe.

#### 3. Health endpoint

**File**: `src/pages/api/health.ts`

**Intent**: Prove the serverless path works end-to-end; give Preview/production a cheap smoke target.

**Contract**:

- `import type { APIRoute } from 'astro'`
- `export const prerender = false`
- `export const GET: APIRoute` returns `jsonResponse({ ok: true })` with status 200
- No dependency on Supabase/Stripe/OpenAI env vars (must succeed when those are unset)
- Do not log environment values

Optional: include `timestamp: new Date().toISOString()` in the JSON body.

#### 4. Barrel export (optional)

**File**: `src/lib/server/index.ts`

**Intent**: Single import path for future routes.

**Contract**: Re-export `response` and `env` helpers. Omit file if direct imports are preferred — not required for F-01 success.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- Build output includes server/API bundling for `/api/health` (on-demand route, not only static pages)

#### Manual Verification:

- `npm run preview` then `curl -sS http://localhost:4321/api/health` returns HTTP 200 and JSON containing `"ok":true`
- `curl -sS http://localhost:4321/` still serves landing page (no regression)

**Implementation Note**: Pause after manual health curl succeeds before Phase 3.

---

## Phase 3: Env & docs

### Overview

Document secret names for upcoming slices, align deploy documentation with hybrid output, and verify on Vercel Preview.

### Changes Required:

#### 1. Environment template

**File**: `.env.example`

**Intent**: Give implementers and Vercel dashboard a canonical list of variable names (no secrets in git).

**Contract**: Include commented sections and empty values for at least:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase admin/server operations |
| `OPENAI_API_KEY` | Server | Model provider for generation/Check |
| `STRIPE_SECRET_KEY` | Server | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Server | Webhook signature verification |
| `PUBLIC_SITE_URL` | Public | Canonical site URL for redirects/links |

Add a short header comment: copy to `.env.local`, never commit `.env`, set Production + Preview in Vercel. Names only — no real values.

#### 2. Deploy plan update

**File**: `context/deployment/deploy-plan.md`

**Intent**: Remove “static only” as the current app output; record F-01 completion criteria.

**Contract**:

- Clarify “Current app output is **static**” with **on-demand** `/api/*` routes (`prerender = false`), not `output: 'hybrid'` (removed in Astro 6).
- In “What was missing” / deferred table, mark on-demand API routes + `maxDuration: 60` as addressed for foundation (health); note AI/Stripe routes still deferred to later changes.
- Add `/api/health` under optional status route or verification section as the smoke URL.

#### 3. AGENTS.md (optional one-liner)

**File**: `AGENTS.md`

**Intent**: Point agents at static + on-demand `/api` convention.

**Contract**: Under project structure or a single bullet, note API routes live in `src/pages/api/` with `prerender = false`. Only add if not redundant after deploy-plan edit — skip if deploy-plan cross-link is enough.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- `.env.example` exists and contains no `=` values that look like real secrets (placeholders empty)

#### Manual Verification:

- Open PR to **`prod`** per `deploy-plan.md`; Vercel Preview deploy succeeds
- `curl -sS https://<preview-deployment>/api/health` → 200, `"ok":true`
- Confirm Preview deployment logs show a Function invocation for `/api/health` (Vercel dashboard)
- Review `deploy-plan.md` diff for accurate hybrid wording

**Implementation Note**: Phase 3 completes F-01. Update `change.md` `status` to `implemented` only after Preview smoke passes (human confirmation).

---

## Testing Strategy

### Unit Tests

Not in scope — no test runner in repo. Rely on build + typecheck + HTTP smoke.

### Integration Tests

Deferred until a test harness exists. Manual Preview curl is the integration gate for F-01.

### Manual Testing Steps

1. `npm run build && npm run astro -- check`
2. `npm run preview` → curl `/` and `/api/health`
3. Push branch, open PR to `prod`, wait for Preview
4. Curl Preview `/api/health`
5. Confirm landing page on Preview `/` unchanged

## Performance Considerations

- Health route is trivial; no cold-start budget concerns for F-01.
- `maxDuration: 60` applies project-wide via adapter — correct for upcoming AI routes; health invocations still complete in milliseconds.

## Migration Notes

- First deploy with on-demand API routes may add Vercel Functions vs pure static — expect function bundle(s) for `/api/*`.
- No database migration.
- Rolling back: revert `output` and adapter options to prior commit; remove `src/pages/api/health.ts` if full rollback needed.

## References

- Roadmap: `context/foundation/roadmap.md` — F-01
- Tech stack: `context/foundation/tech-stack.md`
- Deploy: `context/deployment/deploy-plan.md`
- Infrastructure risks: `context/foundation/infrastructure.md`
- Agent rules: `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Config & adapter

#### Automated

- [x] 1.1 `npm run build` completes with exit code 0
- [x] 1.2 `npm run astro -- check` completes with exit code 0
- [x] 1.3 Build succeeds with adapter + maxDuration; no Astro 6 config errors

#### Manual

- [x] 1.4 `npm run preview` serves landing at `/` without regression

### Phase 2: API pattern

#### Automated

- [x] 2.1 `npm run build` — exit 0
- [x] 2.2 `npm run astro -- check` — exit 0
- [x] 2.3 Build output includes server/API bundling for `/api/health`

#### Manual

- [x] 2.4 Local `curl /api/health` returns 200 and `"ok":true`
- [x] 2.5 Landing at `/` still works after API addition

### Phase 3: Env & docs

#### Automated

- [x] 3.1 `npm run build` — exit 0
- [x] 3.2 `npm run astro -- check` — exit 0
- [x] 3.3 `.env.example` exists with empty placeholder values only

#### Manual

- [x] 3.4 Vercel Preview `/api/health` returns 200
- [x] 3.5 `deploy-plan.md` reflects static + on-demand API routes and health smoke URL
