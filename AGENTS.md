# Repository Guidelines

PrepAhead.dev is an interview-prep web MVP: candidates paste a job description (and optional CV) to get AI-generated practice sets. Stack: Astro 6, React 19 islands, Tailwind v4, Vercel (`@astrojs/vercel`). Product scope lives in `@context/foundation/prd.md` — not the stock `@README.md`.

## Hard rules

- Never commit secrets: `.env` / `.env.*` are gitignored; document names only in `.env.example`.
- AI, billing webhooks, OAuth, and usage metering belong in Astro server routes/endpoints only — no provider API keys in client bundles (`@context/foundation/tech-stack.md`).
- Keep `@astrojs/vercel` in `@astro.config.mjs`; do not switch to Cloudflare Workers.
- Do not invent product behavior — follow `@context/foundation/prd.md`; unresolved scope goes to its Open Questions section.
- Foundation docs are edited in-place; full replacements go to `context/foundation/archive/` (`@context/foundation/README.md`).
- JD/CV and Check payloads are sensitive — avoid logging raw user content.
- Auth-linked data (sessions, theme preference, usage counters) must stay per-user.
- Credentials for auth, payments, and models: Vercel environment variables only.

## Project structure

- `src/pages/` — Astro routes; Google OAuth under `src/pages/api/auth/` (`sign-in`, `callback`, `sign-out`).
- `src/middleware.ts` — session refresh via `getUser()`; unauthenticated `/app/*` → `/login`.
- `src/layouts/` — HTML shells; global CSS via `src/styles/global.css`.
- `src/components/` — `.astro` and React islands (interactive UI → React; shadcn/ui planned per tech stack).
- `public/` — static assets.
- `context/foundation/` — PRD, shape notes, tech stack.
- `context/changes/<id>/` — per-change verification and plans.
- `context/deployment/` — deploy workflow (`deploy-plan.md`).
- `.cursor/` — local agent skills (gitignored).

## Build, test, and development

Scripts and Node engine: `@package.json`. After `.astro` edits, run `npm run astro -- check`.

No test runner or `.github/workflows` gate exists yet — do not claim CI or coverage thresholds that are not in the repo.

## Coding style

Follow `@tsconfig.json` and `@package.json`. Astro for marketing/static pages; React islands for signed-in flows (practice UI, theme toggle FR-022/023, billing). Tailwind utilities in components; shared tokens in `src/styles/global.css`. New files match siblings: PascalCase components (`Welcome.astro`, `Layout.astro`), `index.astro` for route indexes.

## Deployment

Canonical workflow: `@context/deployment/deploy-plan.md`. **Production branch:** `prod`. **Production URL:** `https://prepahead.dev`. Open PRs with **base `prod`**; use Vercel Preview on the PR before merge. Do not push directly to `prod` except documented hotfixes. Vercel auto-deploys on merge to `prod`.

## Commit and pull requests

Recent commits use short imperative subjects (`add themes in requirements`, `init project`) — one concern per commit. Remote: `https://github.com/BartlomiejCzerwinski/PrepAhead.git`. PRs target **`prod`** and should cite relevant FR/US from `@context/foundation/prd.md` and report `npm run build` outcome.
