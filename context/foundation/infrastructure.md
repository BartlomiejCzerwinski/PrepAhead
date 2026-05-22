---
project: PrepAhead.dev
researched_at: 2026-05-22
recommended_platform: Vercel
runner_up: Netlify
context_type: mvp
tech_stack:
  language: JavaScript / TypeScript
  framework: Astro 6 + React 19
  runtime: Node.js >=22.12.0 (serverless on Vercel)
---

## Recommendation

**Deploy on Vercel.**

PrepAhead is already bootstrapped with `@astrojs/vercel` ^10 on Astro 6, and `tech-stack.md` locks `deployment_target: vercel` with Supabase as an external provider. Your interview answers reinforce this: stateless request/response only, DX over bare-minimum cost, existing Vercel/Netlify familiarity, global users, and external DB/auth/billing services are acceptable. Vercel scores Pass on all five agent-friendly criteria, offers first-class Astro deployment, Git-connected preview URLs, and MCP support for agent-driven deploys. Netlify is a credible runner-up but would require an adapter migration and a new credit-based billing model without improving the fit for this repo today.

## Platform Comparison

Hard filter applied: **Cloudflare Workers** dropped — `tech-stack.md` forbids Workers deployment; Astro 6 `@astrojs/cloudflare` targets Workers only (Cloudflare Pages adapter removed per Astro docs, checked 2026-05-22).

Interview weights applied: DX priority (+Vercel, +Netlify); Vercel/Netlify familiarity (+Vercel, +Netlify); global reach (+Vercel CDN, +Cloudflare if considered); external providers OK (neutral — no co-location requirement).

| Platform | CLI-first | Managed / serverless | Agent-readable docs | Stable deploy API | MCP / integration | Total (Pass count) |
|---|---|---|---|---|---|---|
| **Vercel** | Pass | Pass | Pass | Pass | Pass | **5** |
| **Netlify** | Pass | Pass | Pass | Pass | Pass | **5** |
| **Railway** | Pass | Pass | Partial | Pass | Partial | **4** |
| **Render** | Pass | Pass | Partial | Pass | Partial | **4** |
| **Fly.io** | Pass | Pass (VM) | Pass | Pass | Partial | **4** |
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | *(filtered — stack conflict)* |

**Per-platform notes**

- **Vercel:** `vercel` CLI + Git push deploys; Astro guide and `@astrojs/vercel` adapter; docs as MDX on GitHub; Hobby includes ~1M function invocations/month (pricing page, 2026); full Node.js coverage on serverless functions; default max duration 300s Hobby / up to 800s Pro (configurable via adapter `maxDuration`); official MCP deploy path (GA, 2025+). Best match for current repo.
- **Netlify:** `@astrojs/netlify` adapter; official `@netlify/mcp` (June 2025); credit-based plans for new accounts from Sep 2025 — 300 credits free tier, compute at 10 credits/GB-hour; global CDN; would require adapter swap and re-validation of server routes.
- **Railway:** Excellent solo DX, usage-based ~$5/mo Hobby credit; would host Astro via Node/container (`@astrojs/node`), not the current Vercel serverless model — more moving parts for OAuth webhooks + AI routes.
- **Render:** Predictable $7/mo Starter per service; free tier sleeps after 15 min idle — poor fit for signed-in app + webhooks; Astro via static or Docker, not current adapter.
- **Fly.io:** Strong global Machines API and low egress; persistent processes supported (not needed here); Astro requires container/Node path and more ops than Vercel for this MVP timeline.

### Shortlisted Platforms

#### 1. Vercel (Recommended)

Wins on **stack alignment** (adapter already installed, `npm run build` verified), **interview fit** (DX, familiarity, global CDN, external Supabase), and **agent operability** (CLI, deterministic Git deploys, MCP). Serverless Node functions cover Astro server endpoints for AI generation, Check, and billing webhooks without always-on infrastructure.

#### 2. Netlify

Ties Vercel on agent-friendly criteria and matches your JAMstack familiarity. Gap vs. recommendation: requires replacing `@astrojs/vercel` with `@astrojs/netlify`, re-testing SSR/server routes, and learning credit-based metering (production deploys cost 15 credits each). No advantage large enough to justify migration mid-MVP.

#### 3. Railway

Strong for full-stack PaaS with optional co-located Postgres — unnecessary here because Supabase is already chosen. Gap: no first-class Astro+Vercel-style adapter in repo; you would operate a Node server or container, increasing bootstrap and webhook surface area for a 3-week after-hours MVP.

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Weaknesses

1. **Function bundle size** — `@astrojs/vercel` defaults to bundling routes into few serverless functions; a growing API surface can approach compressed size limits (250 MB gzip per function, Vercel docs) unless routes are split deliberately.
2. **Usage-cost opacity** — Fluid compute bills active CPU + memory time; AI-heavy endpoints (generation + Check) can produce spiky spend on Pro if traffic exceeds Hobby included invocations (~1M/month on Hobby pricing page).
3. **Timeout configuration is on you** — PRD targets ~60s generation; adapter `maxDuration` must be set explicitly (e.g. 60–120s) or Vercel returns `504 FUNCTION_INVOCATION_TIMEOUT` (default 300s Hobby is enough, but misconfiguration still happens).
4. **Preview URL data exposure** — Every PR gets a public preview URL by default; JD/CV test data on previews needs Deployment Protection or branch controls before sharing links.
5. **Platform coupling** — Edge middleware mode and Vercel-specific adapter options (e.g. `edgeMiddleware`) increase migration cost if you later leave Vercel; acceptable for MVP if documented.

### Pre-Mortem — How This Could Fail

The team shipped PrepAhead on Vercel with a single bundled serverless function and Hobby-tier limits. Month two, a viral post drove concurrent AI generations; cold starts stacked with 15s default misconfiguration on one route caused mass `504` timeouts during practice-set generation. They fixed timeouts but the monolithic function exceeded size limits after adding billing + quota middleware, forcing an emergency refactor. Meanwhile, preview deployments leaked realistic JD snippets to unlisted URLs crawled by bots. Stripe webhooks occasionally arrived during cold starts and missed idempotency handling, double-counting PRO usage. The builder assumed `astro preview` matched production; it did not — a Node API import worked locally but failed on Vercel until `nodejs` runtime flags were aligned. Six months in, fluid-compute invoices exceeded Supabase + model costs because nobody set spend alerts. The product worked, but trust eroded from timeouts, billing bugs, and preview data handling — all foreseeable with tighter route splitting, `maxDuration`, preview protection, and webhook hardening from day one.

### Unknown Unknowns

- **Local dev ≠ Vercel runtime** — With Astro 6 + `@astrojs/vercel` ^10, use `npm run dev` / `npm run build` + `npm run preview`; do not assume legacy `vercel dev` is required for daily work (confirm against current adapter docs when upgrading).
- **`maxDuration` lives in `astro.config.mjs`** — Not in a loose `vercel.json` alone for Astro-bundled handlers; set on `adapter: vercel({ maxDuration: N })` for AI/billing routes.
- **Webhook routes need idempotency** — Serverless cold starts + retries mean payment and usage events must be idempotent in application code; the platform does not dedupe for you.
- **Hobby vs Pro for production billing** — Live Stripe webhooks and higher concurrency expectations often push teams to Pro early; plan for $20/mo seat + usage, not $0 forever.
- **GitHub Actions + Vercel** — `tech-stack.md` expects auto-deploy on merge; ensure Vercel Git integration or Actions workflow does not double-deploy or skip env vars scoped to Production vs Preview.

## Operational Story

- **Preview deploys**: Connect the GitHub repo in Vercel; each PR/branch gets a unique `*.vercel.app` preview URL automatically. Enable **Deployment Protection** (Vercel dashboard → Project → Deployment Protection) for previews if JD/CV test data appears on branch builds; fork PRs from untrusted contributors may need “Only team members” access (Vercel team setting).
- **Secrets**: Store Supabase keys, payment-provider secrets, and model API keys in **Vercel Project → Settings → Environment Variables** (Production / Preview / Development scopes). Mirror names in `.env.example` locally; run `npx vercel env pull .env.local` after `npx vercel link` for local parity. Never commit `.env` (gitignored). Rotation: update in Vercel dashboard, redeploy Production; revoke old keys at the provider.
- **Rollback**: Vercel dashboard → Deployments → select last green Production deployment → **Promote to Production** (instant alias swap, typically seconds). CLI: `npx vercel rollback` (requires linked project). Database migrations (Supabase) do **not** roll back with the app — keep migrations backward-compatible or run down migrations manually.
- **Approval**: **Human required** — Production promote from arbitrary CLI, deleting the Vercel project, rotating production payment-provider secrets, Supabase RLS/policy changes. **Agent may** — deploy Preview via Git push or `npx vercel deploy` (no `--prod`), tail logs read-only, open PRs, run `npm run build` locally.
- **Logs**: Runtime: `npx vercel logs <deployment-url>` or Vercel dashboard → Logs (Functions). Build: dashboard → Deployment → Build Logs. MCP: Vercel MCP tools (where enabled in Cursor) for deployment status; fallback CLI above.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| AI routes hit 504 timeout | Devil's advocate / Research | M | H | Set `adapter: vercel({ maxDuration: 60 })` (or higher on Pro); stream/progress UX in app; load-test generation path |
| Monolithic function exceeds size limit | Devil's advocate | M | H | Monitor build output size; split heavy API logic into shared modules; revisit route splitting only if Vercel warns on deploy |
| Preview URLs expose JD/CV | Pre-mortem / Unknown unknowns | M | H | Enable Deployment Protection on previews; use synthetic JDs in preview env vars |
| Webhook double-processing | Pre-mortem | M | H | Idempotency keys + event dedupe table in Supabase; return 200 only after persisted handling |
| Fluid compute bill surprise | Devil's advocate | M | M | Vercel spend notifications; cap model provider spend; watch function invocations on dashboard |
| Adapter/platform lock-in | Devil's advocate | L | M | Keep business logic in `src/` framework-agnostic modules; document Vercel-specific config in this file |
| Local/prod runtime mismatch | Unknown unknowns | M | M | CI runs `npm run build`; smoke-test Preview before Production promote; avoid Node-only APIs unsupported on Vercel Node runtime |

## Getting Started

Specific to **Astro 6.3** + **`@astrojs/vercel` ^10** + **npm** (already in repo):

1. **Verify build locally** — `npm run build` (must pass before linking production).
2. **Link project** — `npx vercel link` at repo root; select/create Vercel project `prep-ahead-dev`.
3. **Pull env template** — Add `.env.example` with variable names only; `npx vercel env pull .env.local` for local secrets (never commit).
4. **Configure adapter timeouts** — In `astro.config.mjs`, set `adapter: vercel({ maxDuration: 60 })` (adjust when AI routes are added).
5. **Connect GitHub** — Vercel dashboard → Import Git repository → Production branch `main`; enable automatic deployments; add the same env vars to Production and Preview scopes.
6. **Optional CLI deploy** — `npx vercel deploy` (preview) / `npx vercel deploy --prod` (production, human-gated per Operational Story).

Daily dev loop: `npm run dev` (not platform-specific dev server unless debugging Vercel-only behavior).

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions shape assumed from `tech-stack.md`, not designed here)
- Production-scale architecture (multi-region HA, DR, enterprise SLA)
