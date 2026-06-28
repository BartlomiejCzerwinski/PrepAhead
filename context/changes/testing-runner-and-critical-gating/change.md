---
change_id: testing-runner-and-critical-gating
title: Test runner + critical gating coverage (test-plan Phase 1)
status: implementing
created: 2026-06-28
updated: 2026-06-28
archived_at: null
---

## Notes

Rollout Phase 1 of context/foundation/test-plan.md: "Test runner + critical gating coverage".
Risks covered: #1 (plan/usage gate bypass or miscount) and #2 (authorization / IDOR on practice-set endpoints).
Test types planned: unit + integration. This phase also bootstraps the Vitest runner (see test-plan.md §4 for the Astro 6 / Vitest 4 getViteConfig caveat).
Risk response intent:
- #1: prove that at the FREE limit a generation/Check is blocked with remaining=0, that usage increments only on success (not on failure, never double), and that PRO hard-stops at 300 / daily-caps at 10 above the soft limit.
- #2: prove that a request for another user's practice set [id] is denied (404/403) and never serves or mutates their JD/CV/answers.
