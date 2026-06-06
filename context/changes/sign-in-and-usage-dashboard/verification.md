# S-01 verification checklist

Use a Vercel Preview deployment with Supabase env vars and the `get_current_usage_summary()` migration applied.

## Automated (local)

- [x] `npm run build` — exit 0 (2026-06-05)
- [x] `npm run astro -- check` — exit 0 (2026-06-05)

## Preview smoke

- [x] Signed-in FREE user on `/app` sees plan FREE, remaining generations and Checks
- [x] At-limit FREE user sees upgrade banner linking to `/#plans`
- [x] Two Google accounts in separate sessions: account B never sees account A plan/usage
- [x] Blog CTA from `/blog/*` → `/app` shows dashboard (or login → dashboard)
- [x] OAuth with valid `next=/app` lands on dashboard after sign-in
- [x] `login?next=/%2f%2fevil.com` does not redirect off-site after callback
- [x] `/app` redirects to `/login?error=session` when auth verification fails
- [x] Dashboard renders on mobile without horizontal scroll
- [x] Unsigned `/app` redirects to `/login`

## Database

- [x] `get_current_usage_summary()` returns plan tier, period bounds, and zero counts when no `usage_periods` row exists
