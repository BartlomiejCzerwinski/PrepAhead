---
bootstrapped_at: 2026-05-22T06:29:32Z
starter_id: astro
starter_name: Astro
project_name: prep-ahead-dev
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: astro
package_manager: npm
project_name: prep-ahead-dev
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: true
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

PrepAhead is a solo, after-hours web MVP (3 weeks) needing OAuth, subscriptions, server-side AI (generation + Check), and usage metering. Lead bootstrap: official Astro + React + TypeScript via `astro`, deployed with `@astrojs/vercel` on Vercel—not the 10x Astro Starter unchanged (it targets Cloudflare Workers). UI: **shadcn/ui** on React islands with **Tailwind CSS** for styling. Architecture: Astro for pages, layouts, landing, and blog/content; React + shadcn for interactive app screens; Supabase Auth + Postgres for login and persisted data; Astro server endpoints for all backend logic (billing webhooks, quotas, AI). AI calls only on the server; API keys and secrets only in Vercel environment variables, never client-side. Fallback if faster: clone `10x-astro-starter`, remove Cloudflare adapter/config, add `@astrojs/vercel`, wire shadcn into React islands. Do not deploy on Workers. CI: GitHub Actions, auto-deploy on merge to main.

## Pre-scaffold verification

| Signal             | Value                              | Severity | Notes                              |
| ------------------ | ---------------------------------- | -------- | ---------------------------------- |
| npm package        | create-astro v5.0.6 published 2026-04-22 | fresh    | resolved from cmd_template         |
| GitHub repo        | not run                            | —        | docs_url points at docs.astro.build, not GitHub |

## Scaffold log

**Resolved invocation**: `npm create astro@latest -- .bootstrap-scaffold -- --template basics --install --git --yes` (registry template required an extra `--` before CLI flags on npm; first attempt without it stalled on interactive prompts)

**Post-merge integrations** (hand-off alignment, not in registry cmd): `npx astro add react tailwind vercel --yes`; Tailwind global CSS imported in `src/layouts/Layout.astro`

**Strategy**: subdir-then-move

**Exit code**: 0

**Files moved**: 10

**Conflicts (.scaffold siblings)**: none

**.gitignore handling**: append-merged (cwd + `# from astro`)

**.bootstrap-scaffold cleanup**: deleted (nested `.git` removed before move-up)

## Post-scaffold audit

**Command**: `npm audit --json`

**Exit code**: 1

**Summary**: 3 high severity vulnerabilities (path-to-regexp via `@astrojs/vercel` / `@vercel/routing-utils`). `npm audit fix --force` would downgrade `@astrojs/vercel` — review before applying.

**Tier**: HIGH: 3 | MODERATE: 0 | LOW: 0 | CRITICAL: 0

**Build check**: `npm run build` completed successfully (Vercel adapter, static output).

## Hints recorded but not acted on in v1

- `deployment_target: vercel` — applied via `astro add vercel` during bootstrap (not registry cmd alone)
- `ci_provider: github-actions` — no CI workflow scaffolded in v1
- `ci_default_flow: auto-deploy-on-merge` — no CI workflow scaffolded in v1
- `team_size: solo` — informational
- `path_taken: custom` — logged
- `self_check_answers: null` — logged
- `quality_override: false` — logged
- `has_auth`, `has_payments`, `has_ai` — not scaffolded (Supabase, billing, server routes are follow-up)
- `has_realtime: false`, `has_background_jobs: false` — logged

## Next steps

1. **shadcn/ui** — from project root: `npx shadcn@latest init` (Tailwind v4 + React already present); add components under `src/components/ui/`
2. **Supabase** — add `@supabase/supabase-js` + `@supabase/ssr`; configure Google OAuth; env vars in `.env` (local) and Vercel project settings
3. **Server routes** — create `src/pages/api/` endpoints for AI generation, Check feedback, Stripe webhooks, usage metering (secrets server-side only)
4. **Vercel** — link repo; set env vars; deploy; confirm adapter output in `.vercel/output`
5. **Audit** — triage 3 high npm advisories on `@astrojs/vercel` dependency chain before production
6. **Agent context** — future skill will add `AGENTS.md` / `CLAUDE.md` and CI workflows
