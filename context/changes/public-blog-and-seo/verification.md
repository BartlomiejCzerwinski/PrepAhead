# S-08 verification checklist

Use a Vercel Preview deployment with `PUBLIC_SITE_URL` set to the preview origin.

## Automated (local)

- [ ] `npm run build` — exit 0
- [ ] `npm run astro -- check` — exit 0

## Preview smoke

- [ ] `/blog` lists three launch posts
- [ ] `/blog/java-mid-interview-quiz`, `/blog/behavioral-system-design-prompts`, `/blog/java-collections-quick-quiz` return 200
- [ ] `curl -sS "$PREVIEW_ORIGIN/sitemap-index.xml"` includes `/blog` and all three post URLs (**fetch preview origin directly** — `robots.txt` points at production sitemap by design)
- [ ] View source: `rel="canonical"`, unique `<title>` and `meta description` on index and each post
- [ ] `/robots.txt` served (production `Sitemap:` line is intentional)
- [ ] Footer on `/` and blog pages links to `/blog`
- [ ] CTA links go to `/app` (unauthenticated → `/login` via F-03 middleware)
- [ ] Static and open-ended posts: article body in initial HTML with JS disabled
- [ ] Interactive post: intro in HTML; quiz submits with JS enabled
- [ ] No JD/CV or user practice data on blog pages
- [ ] Light/dark readable via OS `prefers-color-scheme`

## Env

- `PUBLIC_SITE_URL` required on Vercel/CI; local build defaults to `http://localhost:4321` when unset.
