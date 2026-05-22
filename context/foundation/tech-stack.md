---
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
---

## Why this stack

PrepAhead is a solo, after-hours web MVP (3 weeks) needing OAuth, subscriptions, server-side AI (generation + Check), and usage metering. Lead bootstrap: official Astro + React + TypeScript via `astro`, deployed with `@astrojs/vercel` on Vercel—not the 10x Astro Starter unchanged (it targets Cloudflare Workers). UI: **shadcn/ui** on React islands with **Tailwind CSS** for styling. Architecture: Astro for pages, layouts, landing, and blog/content; React + shadcn for interactive app screens; Supabase Auth + Postgres for login and persisted data; Astro server endpoints for all backend logic (billing webhooks, quotas, AI). AI calls only on the server; API keys and secrets only in Vercel environment variables, never client-side. Fallback if faster: clone `10x-astro-starter`, remove Cloudflare adapter/config, add `@astrojs/vercel`, wire shadcn into React islands. Do not deploy on Workers. CI: GitHub Actions, auto-deploy on merge to main.
