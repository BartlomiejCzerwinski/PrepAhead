# S-08 verification checklist

Use a Vercel Preview deployment with `PUBLIC_SITE_URL` set to the preview origin.

## Automated (local)

- [x] `npm run build` — exit 0 (2026-06-04 impl-review)
- [x] `npm run astro -- check` — exit 0 (2026-06-04 impl-review)

## Preview smoke

- [x] `/blog` lists three launch posts (static serve 2026-06-04)
- [x] `/blog/java-mid-interview-quiz`, `/blog/behavioral-system-design-prompts`, `/blog/java-collections-quick-quiz` return 200 (static serve)
- [ ] `curl -sS "$PREVIEW_ORIGIN/sitemap-index.xml"` includes `/blog` and all three post URLs with production/preview `PUBLIC_SITE_URL` (**local dist verified 2026-06-04**)
- [x] View source: `rel="canonical"`, unique `<title>` and `meta description` on index and each post (dist HTML)
- [x] `/robots.txt` served (production `Sitemap:` line is intentional)
- [x] Footer on `/` and blog pages links to `/blog`
- [ ] CTA links go to `/app` (unauthenticated → `/login` via F-03 middleware) — needs Preview
- [x] Open-ended post: article body in initial HTML with JS disabled (dist)
- [x] Interactive-quiz posts: Q&A in initial HTML (`<details>` reveal); aggregate score requires JS (dist has "Reveal answer")
- [ ] Interactive quiz aggregate score in browser — needs JS smoke
- [x] No JD/CV or user practice data on blog pages (code review)
- [ ] Light/dark readable via OS `prefers-color-scheme` — needs browser

## Env

- `PUBLIC_SITE_URL` required on Vercel/CI; local build defaults to `http://localhost:4321` when unset.
