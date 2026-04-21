---
phase: 06-clean-studio-modes
plan: 01
subsystem: ui
tags: [react-context, localStorage, mode-toggle, composer, collapse-fold]

requires:
  - phase: 05-transcript-ui
    provides: CollapseFold, Composer, MessageList, dashboard layout
provides:
  - ModeProvider context with useMode() hook
  - ModeToggle pill component (Clean|Studio)
  - Mode-aware collapse-fold (studio=expanded, clean=collapsed)
  - Studio composer toolbar (@-mention, verbosity, fork button)
affects: [06-clean-studio-modes, process-drawer, interrupt-button]

tech-stack:
  added: []
  patterns: [client-context-for-mode, server-layout-delegates-to-client-shell]

key-files:
  created:
    - apps/web/lib/mode-context.tsx
    - apps/web/components/mode-toggle.tsx
    - apps/web/app/(dashboard)/dashboard-shell.tsx
  modified:
    - apps/web/app/(dashboard)/layout.tsx
    - apps/web/components/transcript/collapse-fold.tsx
    - apps/web/components/transcript/composer.tsx

key-decisions:
  - "DashboardShell client component extracts client-side layout from server component layout.tsx"
  - "Native HTML range input for verbosity slider instead of adding shadcn Slider dependency"
  - "Base-ui TooltipTrigger used directly (no asChild) for fork button tooltip"

patterns-established:
  - "Mode context pattern: useMode() hook returns { mode, toggle, setMode } from ModeProvider"
  - "Server/client split: server layout does auth check, delegates rendering to client DashboardShell"

requirements-completed: [MODE-01, MODE-02, MODE-03, MODE-05]

duration: 3min
completed: 2026-04-21
---

# Phase 06 Plan 01: Mode System Summary

**Clean/Studio mode context with pill toggle, mode-aware collapse folds, and Studio composer toolbar (@-mention, verbosity, fork)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T19:03:31Z
- **Completed:** 2026-04-21T19:06:21Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ModeProvider with localStorage persistence wraps entire dashboard via DashboardShell
- Pill-shaped Clean|Studio toggle in header with gold active segment and Cmd+Shift+M shortcut
- CollapseFold defaults expanded in Studio, collapsed in Clean, reacts to mode changes
- Composer shows Studio toolbar with @-mention dropdown (Mo, Jarvis, Sentinel), verbosity slider (5 levels), and disabled fork button

## Task Commits

Each task was committed atomically:

1. **Task 1: Mode context provider and header toggle** - `81b8835` (feat)
2. **Task 2: Mode-aware collapse-fold and composer with Studio controls** - `6a0d378` (feat)

## Files Created/Modified
- `apps/web/lib/mode-context.tsx` - ModeProvider, useMode() hook, Mode type, localStorage persistence
- `apps/web/components/mode-toggle.tsx` - Pill toggle with gold active segment, keyboard shortcut
- `apps/web/app/(dashboard)/dashboard-shell.tsx` - Client component shell wrapping ModeProvider + Sidebar + header
- `apps/web/app/(dashboard)/layout.tsx` - Simplified to server auth check + QueryProvider + DashboardShell
- `apps/web/components/transcript/collapse-fold.tsx` - useState(mode === 'studio'), useEffect resets on mode change
- `apps/web/components/transcript/composer.tsx` - Studio toolbar with @-mention, verbosity slider, fork button

## Decisions Made
- Extracted DashboardShell as client component since ModeProvider needs client context but layout.tsx must remain a server component for requireTenantContext()
- Used native HTML range input with Tailwind styling for verbosity slider instead of adding shadcn Slider (avoids new dependency)
- Base-ui TooltipTrigger rendered directly (no asChild prop) for the disabled fork button

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TooltipTrigger asChild not supported by base-ui**
- **Found during:** Task 2 (composer Studio controls)
- **Issue:** Plan specified `<TooltipTrigger asChild>` wrapping a Button, but base-ui tooltip doesn't support asChild prop
- **Fix:** Used TooltipTrigger directly with inline styling classes instead of wrapping a Button
- **Files modified:** apps/web/components/transcript/composer.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 6a0d378 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor API adaptation, no scope change.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Fork button disabled | apps/web/components/transcript/composer.tsx | ~160 | Intentional per D-10: functionality deferred to v2, button visible with "coming soon" tooltip |
| Verbosity metadata not consumed | apps/web/components/transcript/composer.tsx | ~98 | Verbosity sent in payload metadata but Hub /send doesn't consume it yet (future plan) |
| targetAgent not wired to mutation type | apps/web/components/transcript/composer.tsx | ~95 | Cast needed; useSendMessage mutation type doesn't include targetAgent/metadata yet |

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Mode context available everywhere under dashboard layout via useMode()
- Phase 06-02 (process drawer, interrupt button) can build on mode system
- All mode-aware components react to toggle changes in real time

## Self-Check: PASSED

All 6 files verified present. Both commits (81b8835, 6a0d378) confirmed in git log.

---
*Phase: 06-clean-studio-modes*
*Completed: 2026-04-21*
