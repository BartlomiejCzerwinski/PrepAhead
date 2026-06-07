# S-02 verification checklist

Use a Vercel Preview or production deployment with Supabase env vars, `generation_jobs` migrations applied, and `OPENAI_API_KEY` configured.

## Automated (local)

- [x] `npm run build` — exit 0 (2026-06-07)
- [x] `npm run astro -- check` — exit 0, 0 errors (2026-06-07)

## Generation happy path

- [x] Signed-in user navigates `/app` → `/app/generate` → submits JD → lands on `/app/sets/[id]`
- [x] JD-only generation persists one exact-20 `practice_sets` row and increments generation usage once
- [x] JD + valid PDF CV generation persists `cv_text` and produces one exact-20 set
- [x] Generated-set overview renders 15 ABCD + 5 open-ended questions read-only (no answer/Check controls)

## Recovery and durability

- [x] Staged loading screen visible during generation
- [x] Browser leave warning shown while a recoverable job is active
- [x] Returning to `/app/generate` resumes in-flight generation via status polling
- [x] Leave-and-return produces one final set without duplicate usage increments (observed in manual testing)

## Upload and limits

- [x] Valid PDF upload returns parsed resume text for the hidden generation flow
- [ ] PDF parse failure paths (non-PDF, empty extraction, oversize) — not re-verified in final pass
- [ ] FREE user at generation limit blocked before provider call with upgrade path — not re-verified in final pass
- [ ] Malformed provider output fails without incrementing generation usage — deferred; `simulateMalformed` dev hook exists (plan 4.4 left unchecked pending explicit run)

## Operational notes

- Generation worker runs inline in a Vercel function (60 s budget). Stale `running` jobs are reclaimable after ~65 s; client polling may time out first—return to `/app/generate` to recover.

## Database / migrations

- [x] `generation_jobs` + `finalize_generation_job` migrations applied on production Supabase (generation + save verified live)
- [ ] Local `supabase db reset` workflow — skipped (Docker Desktop unavailable during implementation)

## Commits (reference)

| Phase | SHA | Scope |
|-------|-----|-------|
| 1 | `62f5a2a` | Generation entry flow |
| 2 | `2dd2478`, `514f48d` | Server pipeline, finalize fix |
| 3 | `4013e1c` | Recovery, status polling, overview |
