---
change_id: supabase-oauth-auth
status: implementing
created: 2026-05-30
updated: 2026-05-30
notes: Google OAuth only; middleware gate on /app/*; hosted Supabase for local OAuth dev
roadmap_ref: F-03
roadmap_outcome: (foundation) sign in via Google OAuth; sessions protect practice routes
prd_refs:
  - FR-001
  - Access Control
---

# Change: supabase-oauth-auth

Foundation slice **F-03** from `context/foundation/roadmap.md`. Wires Supabase Auth (Google OAuth) into Astro with SSR session cookies, auth API routes, middleware protection for `/app/*`, and a `/login` entry point. Unlocks S-01 and all signed-in practice slices.
