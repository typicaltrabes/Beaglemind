---
phase: 12-ui-polish-from-phase-11-uat
plan: 01
subsystem: ui

tags: [css, tailwind-v4, oklch, theme, dark-mode, hydration]

# Dependency graph
requires:
  - phase: 11-run-view-tabs
    provides: existing dashboard layout with `<html className="dark">` and shadcn primitives reading var(--background)/var(--card)/var(--sidebar)
provides:
  - ":root in apps/web/app/globals.css now resolves to the dark palette unconditionally"
  - "Light theme is impossible to render — no JS branch, no class toggle, no theme provider"
  - ".dark block preserved verbatim as a defensive cascade target"
affects: [phase-12 plans 02-04 (UI polish on top of dark surfaces), any future visual UAT, deploy plan 12-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unconditional palette: :root and .dark contain identical CSS custom property values, so dark wins regardless of cascade timing or hydration state"

key-files:
  created: []
  modified:
    - "apps/web/app/globals.css"

key-decisions:
  - "Make :root identical to .dark rather than introduce a theme provider, prefers-color-scheme media query, or JS branch — the product has no light theme by design (CONTEXT.md §Defect 1)"
  - "Keep the .dark block byte-for-byte unchanged so anything that explicitly targets `.dark *` via the existing `@custom-variant dark (&:is(.dark *));` keeps working"
  - "Keep --radius: 0.625rem in :root only — it has no light/dark variant and was correctly scoped already"

patterns-established:
  - "CSS-only theme lock: when a product has a single visual mode, putting the palette in :root (and mirroring it in .dark for defensive cascade) is preferable to JS-driven theme switching"

requirements-completed: [UAT-12-01]

# Metrics
duration: 4min
completed: 2026-04-27
---

# Phase 12 Plan 01: Dark theme Run History Summary

**Forced `:root` to the dark oklch palette in `globals.css` so /runs (and every other route) renders dark on first paint with zero hydration flash**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-27T13:40:13Z
- **Completed:** 2026-04-27T13:43:34Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Replaced 13 light-palette `:root` CSS custom properties with their `.dark` counterparts (background, card, popover, secondary, muted, accent, border, input, sidebar, sidebar-accent, sidebar-border + their foregrounds and primaries)
- Eliminated the hydration-window race where `var(--card)` / `var(--popover)` / `var(--sidebar)` could resolve to white before `<html className="dark">` cascades took effect
- Preserved `--radius: 0.625rem` in `:root` (no light/dark variant)
- Preserved the entire `.dark` block byte-for-byte (defensive — `@custom-variant dark (&:is(.dark *));` still resolves)

## Task Commits

Each task was committed atomically:

1. **Task 1: Force :root to dark palette** - `eaf9171` (feat)

## Files Created/Modified

- `apps/web/app/globals.css` — `:root` block now contains the same oklch values as `.dark` for every shared variable. `--radius` retained. `.dark` block unchanged.

## Decisions Made

- **CSS-only fix, no JS:** Per CONTEXT.md `<decisions>` §Defect 1, the product has no light theme by design and no toggle is planned. Mirroring values into `:root` is the smallest possible diff that makes light theme impossible to render.
- **Keep `.dark` block intact:** Removing `.dark` would seem redundant after this change, but `@custom-variant dark (&:is(.dark *));` is wired up at the Tailwind variant level. Keeping `.dark` ensures any class-targeted overrides (now or later) continue to resolve. Identical values mean no visual difference either way.
- **Keep `<html className="dark">`:** Not removed. The class becomes idempotent rather than load-bearing. Removing it would be a separate refactor outside this plan's scope.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Workspace dependencies were not installed** when typecheck was attempted (`tsc` not found). Resolved by running `pnpm install --frozen-lockfile` from the workspace root (one trailing EPERM on an unrelated package — `get-east-asian-width` symlink — which did not affect TypeScript availability). After install, `cd apps/web && pnpm exec tsc --noEmit` exited 0 as required by the plan's automated verify step. Not a code issue and not a deviation — just an environment bootstrap that the plan didn't enumerate.
- **Parallel executors were running on the same checkout** (other Phase 12 plans). Avoided cross-contamination by staging only `apps/web/app/globals.css` (per `<task_commit_protocol>`: never `git add .`, never `git add -A`). Verified after commit that no unrelated files leaked into commit `eaf9171`.

## Verification

- `grep "background: oklch(0.145 0 0)" apps/web/app/globals.css` — present in `:root` (line 60) and `.dark` (line 95)
- `grep -c "oklch(1 0 0)$" apps/web/app/globals.css` — returns 0 (the white-no-alpha value is gone from `:root`; the `oklch(1 0 0 / 10%)` and `/ 15%` alpha variants remain on `--border` / `--input` in both blocks, as designed)
- `--card: oklch(0.205 0 0)`, `--popover: oklch(0.205 0 0)`, `--muted: oklch(0.269 0 0)`, `--sidebar: oklch(0.205 0 0)`, `--sidebar-primary: oklch(0.488 0.243 264.376)` all present in `:root`
- `--radius: 0.625rem` preserved in `:root`
- `.dark` block still present (`grep -c "^\.dark {"` returns 1)
- `apps/web/app/layout.tsx` still contains `className={cn("dark"`
- `cd apps/web && pnpm exec tsc --noEmit` exited 0

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plans 12-02, 12-03, 12-04 build visual polish on top of these dark surfaces. They can rely on `var(--card)`, `var(--popover)`, `var(--sidebar)` resolving to dark values regardless of cascade timing.
- Final visual confirmation happens at deploy time in Plan 12-05 against `https://console.beaglemind.ai/runs` (fresh incognito session, observe dark background on first paint and after hydration).

## Self-Check: PASSED

- FOUND: `apps/web/app/globals.css` (modified, oklch values match `.dark`)
- FOUND: commit `eaf9171` in `git log` (`feat(12-01): force :root to dark palette in globals.css`)
- FOUND: 1 file changed, 25 insertions(+), 25 deletions(-) — symmetric replacement, no spillover
- VERIFIED: `pnpm exec tsc --noEmit` exits 0 (no TS regressions from a CSS-only change)

---
*Phase: 12-ui-polish-from-phase-11-uat*
*Completed: 2026-04-27*
