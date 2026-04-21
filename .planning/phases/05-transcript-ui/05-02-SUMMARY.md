---
phase: 05-transcript-ui
plan: 02
subsystem: ui
tags: [react, zustand, transcript, collapse, tldr, tailwind]

# Dependency graph
requires:
  - phase: 05-transcript-ui
    provides: "Agent config, scene grouping in run-store, hub event types"
provides:
  - "detectCollapsibleRanges pure function for identifying foldable agent exchanges"
  - "CollapseFold component with dashed-border expand/collapse UI"
  - "TldrBanner sticky component subscribing to tldrSummary store state"
affects: [05-03, 06-clean-studio-mode]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Pure collapse detection algorithm decoupled from store", "Render callback pattern for CollapseFold expansion"]

key-files:
  created:
    - apps/web/lib/scene-utils.ts
    - apps/web/components/transcript/collapse-fold.tsx
    - apps/web/components/transcript/tldr-banner.tsx
  modified: []

key-decisions:
  - "CollapseFold uses renderEvent callback prop for expansion — parent controls how events render"
  - "Collapse detection is a pure function taking eventOrder + events, no store coupling"

patterns-established:
  - "Collapse detection: detectCollapsibleRanges(eventOrder, events) returns CollapsibleRange[]"
  - "Fold component: renderEvent callback pattern for parent-controlled event rendering"

requirements-completed: [TRAN-04, TRAN-05]

# Metrics
duration: 2min
completed: 2026-04-21
---

# Phase 5 Plan 2: Collapse Fold + TLDR Banner Summary

**Pure collapse detection algorithm for >3 agent exchanges with dashed-border fold component and sticky dark-blue TLDR banner**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-21T18:32:42Z
- **Completed:** 2026-04-21T18:34:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Built pure detectCollapsibleRanges function that walks event order and identifies runs of >3 consecutive non-user agent_message events
- Created CollapseFold component with dashed border, agent name formatting, message count, time span, and chevron expand/collapse
- Built TldrBanner component with sticky positioning, dark blue/teal wireframe colors, "Where we are" label, hidden until first tldr_update

## Task Commits

Each task was committed atomically:

1. **Task 1: Collapse detection algorithm + CollapseFold component** - `3e6e716` (feat)
2. **Task 2: TLDR banner component** - `13a4385` (feat)

## Files Created/Modified
- `apps/web/lib/scene-utils.ts` - Pure detectCollapsibleRanges function with CollapsibleRange interface
- `apps/web/components/transcript/collapse-fold.tsx` - Dashed-border fold with expand/collapse, agent names, count, time span
- `apps/web/components/transcript/tldr-banner.tsx` - Sticky TLDR banner subscribing to run-store tldrSummary

## Decisions Made
- CollapseFold takes a `renderEvent` callback prop so the parent (message list) controls how expanded events render — avoids tight coupling to AgentMessage
- detectCollapsibleRanges is pure (no store dependency) — receives eventOrder and events as args, making it testable and reusable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CollapseFold and detectCollapsibleRanges ready for integration into the virtualized message list (Plan 03)
- TldrBanner ready to mount at top of transcript scroll area in Plan 03
- Both components type-check cleanly against Plan 01 interfaces

---
## Self-Check: PASSED
