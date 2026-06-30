<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Theme Preference on All Surfaces

- **Plan**: context/changes/theme-preference-all-surfaces/plan.md
- **Mode**: Deep
- **Date**: 2026-06-27
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

10/10 existing paths ✓, 3/3 new paths absent ✓, symbols ✓ (Tailwind v4 `4.3.0`, `@custom-variant` absent today, `prefers-color-scheme` present, `@astrojs/react` present), brief↔plan ✓, Progress↔Phase ✓. OAuth-callback cookie-set pattern proven (existing callback uses `cookies.delete`).

## Findings

### F1 — The optional `class="light"` placeholder defeats the no-JS fallback

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 #3 + Critical Implementation Details (CSS strategy)
- **Detail**: The CSS strategy scopes the retained `@media (prefers-color-scheme: dark)` fallback to "no explicit `.light`/`.dark` class present," but Phase 1 #3 suggested optionally adding a static `class="light"` placeholder on `<html>`. With the placeholder, a no-JS visitor always carries `.light`, so the dark media-query fallback never fires — a no-JS dark-OS user is stuck in light.
- **Fix**: Drop the `class="light"` placeholder; the inline script is the only thing that ever sets a theme class.
- **Decision**: FIXED (placeholder removed from Phase 1 #3 with rationale)

### F2 — Success criterion 3.5 (live OS follow) has no backing change item

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 (criterion 3.5) vs Phase 1 #2 (client lib contract)
- **Detail**: Criterion 3.5 promises `system` follows the OS live, but the inline script and `client.ts` only resolve `system` once at load; no Change Required item specified a `matchMedia` `change` listener.
- **Fix**: Add `watchSystem(onChange)` to the client lib and wire it into ThemeToggle (active only while pref === 'system').
- **Decision**: FIXED (added to Phase 1 #2 and Phase 3 #1 contracts)

### F3 — No-JS dark users keep token colors but lose `dark:` utility overrides

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details (CSS strategy)
- **Detail**: `dark:` utilities keyed on the `.dark` class won't apply for no-JS visitors; CSS-variable tokens still flip via the retained media query. Cosmetic-only.
- **Fix**: Note as an accepted no-JS degradation in "What We're NOT Doing."
- **Decision**: FIXED (documented in "What We're NOT Doing")
