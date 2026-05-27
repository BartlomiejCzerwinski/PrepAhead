# Server API foundation — Plan Brief

> Full plan: `context/changes/server-api-foundation/plan.md`

## What & Why

PrepAhead must run AI generation, billing webhooks, and OAuth callbacks on the server so secrets never reach the client (`AGENTS.md`, `tech-stack.md`). Today the repo is static-only: `@astrojs/vercel` is wired but there are no API routes. This change turns on **hybrid** Astro output on Vercel, sets **60s** function duration for upcoming AI routes, and establishes the `/api/*` + `src/lib/server` pattern with a live **health** endpoint.

## Starting Point

- `astro.config.mjs` uses `adapter: vercel()` with default static output; no `src/pages/api/`.
- `deploy-plan.md` documents static scope and lists `output: 'server'|'hybrid'` and `maxDuration: 60` as deferred.
- Landing pages exist under `src/pages/index.astro` and `src/components/landing/`.

## Desired End State

- `npm run build` and `npm run astro -- check` pass with `output: 'hybrid'` and `vercel({ maxDuration: 60 })`.
- `GET /api/health` returns JSON `{ "ok": true }` on local preview and Vercel Preview (not prerendered).
- `.env.example` documents all upcoming secret **names** (no values); `deploy-plan.md` reflects hybrid + API foundation.
- Downstream changes (F-03 auth, S-02 generation, S-05 Stripe) add routes beside the same pattern — no config rework.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Output mode | `hybrid` | Keeps marketing/blog pages static; only `/api/*` is serverless. | Plan |
| F-01 API surface | `/api/health` only | Proves deploy path without stubbing unfinished domains. | Plan |
| Route layout | `src/pages/api/*.ts` (`APIRoute`) | Matches Astro docs and `deploy-plan` backlog. | Plan |
| `.env.example` | Full skeleton | Unblocks F-02/F-03/S-02 env naming before secrets exist. | Plan |
| Shared server lib | Minimal (`jsonResponse`, env guard) | Avoids premature abstraction; enough for consistent handlers. | Plan |
| `maxDuration` | Set to 60 in F-01 | PRD ~60s generation target; deploy-plan requires it before AI. | Plan |
| Verification | Build + astro check + Preview `/api/health` | Catches Vercel-only issues static build misses. | Plan |
| Docs | Update `deploy-plan.md` | Repo truth must match hybrid output after merge. | Plan |

## Scope

**In scope:**

- `output: 'hybrid'`, `adapter: vercel({ maxDuration: 60 })`
- `src/pages/api/health.ts` with `prerender = false`
- `src/lib/server/` minimal helpers
- `.env.example` (names only)
- `deploy-plan.md` scope update

**Out of scope:**

- Supabase client, schema, migrations (F-02)
- Google OAuth, session middleware, protected pages (F-03)
- OpenRouter / generation or Check endpoints (S-02, S-04)
- Stripe checkout or webhooks (S-05)
- Auth or quota enforcement on `/api/health`
- Test runner / CI workflow
- shadcn, React practice UI

## Architecture / Approach

```
[Static pages]  index.astro, future blog/*.astro  →  prerendered (default in hybrid)
[API routes]    src/pages/api/*.ts               →  Vercel serverless (prerender = false)
[Shared]        src/lib/server/*                 →  json helpers, env guards (no provider SDKs)
[Secrets]       import.meta.env.*                →  Vercel env + .env.local (gitignored)
```

Future routes (`/api/auth/*`, `/api/generate`, `/api/webhooks/stripe`) colocate under `src/pages/api/` using the same `APIRoute` export pattern.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Config & adapter | Hybrid output + 60s timeout; build green | Hybrid mis-config breaks static pages |
| 2. API pattern | `/api/health` + `src/lib/server` helpers | Forgetting `prerender = false` → static 404 on Vercel |
| 3. Env & docs | `.env.example`, deploy-plan, Preview smoke | Preview env vars empty — health should still 200 |

**Prerequisites:** Node `>=22.12.0`, Vercel project linked (for Preview smoke).  
**Estimated effort:** ~1–2 focused sessions across 3 phases.

## Open Risks & Assumptions

- First hybrid deploy may surface Vercel adapter warnings (bundle size, route list) — acceptable for health-only surface.
- `npm run preview` behavior may differ slightly from Vercel Preview; Preview smoke remains the gate.
- No test runner in repo — verification is build + manual/Preview only.

## Success Criteria (Summary)

- Production build succeeds with hybrid + extended duration.
- `/api/health` responds on Vercel Preview without auth.
- `.env.example` lists upcoming secret names; deploy docs no longer say “static only.”
