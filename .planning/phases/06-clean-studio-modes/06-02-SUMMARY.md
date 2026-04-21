---
phase: 06-clean-studio-modes
plan: 02
subsystem: ui
tags: [process-drawer, collapsible, sentinel, cost-tracking, interrupt, studio-mode]

requires:
  - phase: 06-clean-studio-modes
    provides: ModeProvider, useMode() hook, mode-aware components
provides:
  - ProcessDrawer with 3 collapsible sections (Sentinel, Cost, Fork)
  - InterruptButton for in-flight agent interruption
  - Run page Studio layout (transcript + drawer side-by-side)
affects: [sentinel-integration, cost-api, fork-feature, hub-interrupt-endpoint]

tech-stack:
  added: [base-ui-collapsible]
  patterns: [event-metadata-scanning, reverse-event-lookup-for-active-agent]

key-files:
  created:
    - apps/web/components/studio/process-drawer.tsx
    - apps/web/components/studio/sentinel-section.tsx
    - apps/web/components/studio/cost-section.tsx
    - apps/web/components/studio/fork-section.tsx
    - apps/web/components/studio/interrupt-button.tsx
    - apps/web/components/ui/collapsible.tsx
  modified:
    - apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx

key-decisions:
  - "System message interrupt via existing /messages endpoint instead of dedicated /interrupt route (Hub doesn't support it yet)"
  - "Sentinel detection forward-compatible: checks metadata.sentinelFlag and system events from sentinel source"
  - "Cost aggregation reads costUsd from agent_message metadata and estimatedCostUsd from plan_proposal metadata"

patterns-established:
  - "Event metadata scanning: sections iterate eventOrder and read typed metadata fields"
  - "Active agent detection: reverse-iterate events to find last non-user/non-system agent_message"
  - "Conditional Studio layout: isStudio flag controls drawer + interrupt visibility at run page level"

requirements-completed: [MODE-04, MODE-06]

duration: 3min
completed: 2026-04-21
---

# Phase 06 Plan 02: Process Drawer & Interrupt Summary

**Studio-mode process drawer (320px) with sentinel/cost/fork sections and in-flight agent interrupt button**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T19:08:13Z
- **Completed:** 2026-04-21T19:12:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ProcessDrawer renders at 320px with three independently collapsible sections in Studio mode
- SentinelSection scans events for sentinel flags with severity-colored left borders (forward-compatible for when sentinel data flows)
- CostSection aggregates costUsd from event metadata with per-agent breakdown and progress bar against estimate
- InterruptButton detects active in-flight agent by reverse-scanning events, sends system interrupt message
- Run page layout conditionally splits transcript + drawer in Studio, full-width in Clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Process drawer with sentinel, cost, and fork sections** - `b8d03b8` (feat)
2. **Task 2: Interrupt button and run page layout integration** - `d0498e5` (feat)

## Files Created/Modified
- `apps/web/components/ui/collapsible.tsx` - shadcn Collapsible wrapper around base-ui primitives
- `apps/web/components/studio/sentinel-section.tsx` - Sentinel flags section with empty state and severity-colored items
- `apps/web/components/studio/cost-section.tsx` - Cost tracking with total, estimate progress bar, per-agent breakdown
- `apps/web/components/studio/fork-section.tsx` - Fork/branch placeholder section (default collapsed)
- `apps/web/components/studio/process-drawer.tsx` - 320px drawer shell composing three sections from run store data
- `apps/web/components/studio/interrupt-button.tsx` - Red interrupt button detecting active agent, sends system message
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` - Conditional Studio layout with drawer and interrupt

## Decisions Made
- Used system message via existing /messages endpoint for interrupt (Hub lacks dedicated /interrupt route); TODO comment marks future replacement
- Sentinel detection is forward-compatible: checks both metadata.sentinelFlag and system events with content.source === 'sentinel'
- Cost data reads costUsd from agent_message metadata and estimatedCostUsd from plan_proposal metadata (LiteLLM pipeline will populate these)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Fork section placeholder | apps/web/components/studio/fork-section.tsx | ~30 | Intentional per D-10/D-13: fork functionality deferred to v2, shows "will appear here" text |
| Interrupt sends system message not true interrupt | apps/web/components/studio/interrupt-button.tsx | ~42 | Hub lacks per-agent /interrupt endpoint; uses existing /messages with [SYSTEM] prefix as interim |
| Sentinel empty state | apps/web/components/studio/sentinel-section.tsx | ~80 | Forward-compatible: sentinel events not yet flowing from Hub pipeline, section will auto-populate |
| Cost shows $0.00 | apps/web/components/studio/cost-section.tsx | ~65 | Forward-compatible: costUsd metadata not yet set by Hub/LiteLLM pipeline, will auto-populate |

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Studio mode feature set complete: mode toggle, composer controls (06-01), process drawer, interrupt (06-02)
- Hub pipeline needs to populate metadata.costUsd and metadata.sentinelFlag for drawer sections to show real data
- Dedicated /interrupt endpoint needed in Hub for true per-agent interrupt (currently sends system message)

## Self-Check: PASSED

All 7 files verified present. Both commits (b8d03b8, d0498e5) confirmed in git log.

---
*Phase: 06-clean-studio-modes*
*Completed: 2026-04-21*
