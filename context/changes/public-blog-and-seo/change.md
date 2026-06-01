---
id: public-blog-and-seo
title: Public blog and SEO
status: implementing
created: 2026-05-30
updated: 2026-06-01
roadmap: S-08
prd_refs:
  - FR-024
  - FR-025
  - FR-026
  - FR-027
  - FR-028
  - FR-029
  - FR-030
  - FR-031
  - FR-032
  - US-05
---

# Public blog and SEO

Roadmap slice **S-08**: public blog index, three launch post formats (static quiz, open-ended, interactive quiz), SEO metadata + sitemap, CTAs to practice flow. Parallel track — no auth prerequisite.

## Notes

- **PUBLIC_SITE_URL:** Required on Vercel/CI (`VERCEL=1` or `CI=true`); local `npm run build` defaults to `http://localhost:4321` when unset. Set in Vercel for correct canonical URLs and sitemap on Preview/Production.
