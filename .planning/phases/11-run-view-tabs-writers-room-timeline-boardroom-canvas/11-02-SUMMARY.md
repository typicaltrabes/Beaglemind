---
phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas
plan: 02
subsystem: ui

tags:
  - timeline
  - scrubber
  - run-view
  - clean-studio
  - scene-dividers
  - tooltip

# Dependency graph
requires:
  - phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas
    provides: Tabs primitive, getAgentColor, renderEvent, RunViewTabs placeholder panel with data-testid="run-view-timeline"
  - phase: 05-transcript-ui
    provides: AgentMessage, PlanCard, QuestionCard, ArtifactCard (consumed via renderEvent)
  - phase: 06-clean-studio-modes
    provides: useMode (clean/studio) — drives Timeline event filter

provides:
  - TimelineView component (components/run-views/timeline-view.tsx)
  - timeline-utils pure helpers (lib/timeline-utils.ts) — filterTimelineEvents, computeXPositions, nearestEventBySeq, sceneBoundaries + SceneBoundary type
  - 15 vitest assertions covering every helper behavior bullet from the plan
  - Timeline TabsPanel wired: placeholder replaced with <TimelineView runId={runId} />

affects:
  - 11-03-PLAN (Boardroom can follow same pattern — drops into run-view-boardroom panel, reuses renderEvent + getAgentColor)
  - 11-04-PLAN (Canvas — same integration surface)
  - 11-05-PLAN (deploy + UAT — Timeline ready for manual check)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Horizontal scrub lane: overflow-x-auto outer wrapper + percent-positioned dots in an inner div with minWidth = max(count * 24px, 100px)'
    - 'Scene divider x-position computed against the visible-event time range (not event indices) so dividers align with dots on the same coordinate system'
    - 'Tie-break on nearestEventBySeq goes to the LOWER sequence — deterministic and matches plan spec'
    - 'divide-by-zero guard in computeXPositions: span===0 → all positions are 0 (single-event or identical-timestamp runs)'
    - 'filterTimelineEvents always drops tldr_update (defensive — deriveState already does, but Timeline reads from raw events[] by seq)'
    - 'Selected-seq toggle: clicking the same dot clears selection; different dot replaces it; Close button clears'
    - 'Tooltip content format: displayName + type + 80-char preview (from content.text or content.summary); empty preview suppressed'

key-files:
  created:
    - apps/web/lib/timeline-utils.ts
    - apps/web/lib/timeline-utils.test.ts
    - apps/web/components/run-views/timeline-view.tsx
  modified:
    - apps/web/components/run-views/run-view-tabs.tsx

key-decisions:
  - "Tooltip TooltipTrigger uses the render-prop form so the trigger IS the positioned <button> — avoids nesting a button inside the trigger and lets the absolute-positioning + agent-color class land on a single focusable element"
  - "Tooltip preview reads content.text OR content.summary (falls back to empty string) — plan-proposal / artifact / question events have no text field, so summary is the reasonable secondary source"
  - "Scene label strip sits above the lane (h-6) rather than on top of dots — prevents label overlap with dots and keeps the 64px lane visually clean"
  - "Scrubber is disabled when there is exactly one visible event (firstSeq===lastSeq) — native range with min===max produces confusing interaction"
  - "Selected dot gets ring-2 + scale-125 as a visual 'pressed' indicator; aria-pressed mirrors state for a11y"
  - "Used getAgentConfig().displayName for tooltip title (Mo / Jarvis / Sentinel / You) — matches Writers' Room copy; raw agentId reads like debug output"

patterns-established:
  - "timeline-utils as a sibling of state-machine — pure data-shaping helpers live in lib/ with colocated vitest"
  - "Tab-view component contract: (runId: string) → ReactNode, reads useRunStore + useMode directly, wraps itself in TooltipProvider when needed"

requirements-completed:
  - VIEW-01

# Metrics
duration: 3min
completed: 2026-04-22
---

# Phase 11 Plan 02: Timeline View Summary

**VIEW-01 Timeline tab: horizontal scrubbable replay with agent-colored dots, scene dividers, hover tooltips, click-to-select detail panel, and a snap-to-nearest sequence scrubber — all reading from useRunStore with Clean/Studio mode filtering.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-22T12:48:22Z
- **Completed:** 2026-04-22T12:51:38Z
- **Tasks:** 2 (Task 1 executed as TDD RED → GREEN; Task 2 as feat)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Four pure helpers (`filterTimelineEvents`, `computeXPositions`, `nearestEventBySeq`, `sceneBoundaries`) in `apps/web/lib/timeline-utils.ts` with a `SceneBoundary` type.
- 15 vitest assertions in `apps/web/lib/timeline-utils.test.ts` — each behavior bullet from the plan has explicit coverage (mode-aware filters, divide-by-zero guard, tie-to-lower on scrubber snap, empty/missing-event scene skipping).
- `TimelineView` component at `apps/web/components/run-views/timeline-view.tsx`:
  - Reads `eventOrder / events / scenes` from `useRunStore` and `mode` from `useMode`.
  - Renders a 64px lane with a scene-label strip above and a native range scrubber below.
  - Each visible event is a colored dot at `left: calc(${x*100}% - 6px)` with hover tooltip and click-to-toggle-detail panel.
  - Scene dividers render as 1px dotted vertical lines at their own x-coordinate on the event time-range.
  - Detail panel reuses `renderEvent(events[selectedSeq], runId)` for identical rendering to Writers' Room.
  - Empty state `"Run has not started yet"` when `eventOrder.length === 0`.
  - Horizontal scroll wrapper + inner `minWidth: visible.length * 24px` so dots stay proportional even on dense runs.
- `run-view-tabs.tsx` wired: placeholder replaced with `<TimelineView runId={runId} />`; `data-testid="run-view-timeline"` preserved for downstream plans.
- Full apps/web vitest suite stays green (33/33) and `pnpm exec tsc --noEmit` exits 0.

## Task Commits

1. **Task 1 (RED):** `6ddb271` — `test(11-02)` failing tests for timeline-utils helpers (module does not yet exist).
2. **Task 1 (GREEN):** `e5b7f8d` — `feat(11-02)` implement timeline-utils pure helpers; 15/15 tests pass.
3. **Task 2:** `bebb2ec` — `feat(11-02)` implement TimelineView and wire into run-view tabs.

_Task 1 followed the TDD gate (RED then GREEN); Task 2 did not create a new test file (the plan's `<verify>` for Task 2 is `tsc --noEmit` — behavioral coverage lives in the pure helpers, which is exactly where the logic sits)._

## Files Created/Modified

- `apps/web/lib/timeline-utils.ts` — four pure functions plus `SceneBoundary` interface. 92 lines. No React imports.
- `apps/web/lib/timeline-utils.test.ts` — 15 `it(...)` blocks across 4 `describe(...)` suites. Uses a `mkEvent()` fixture helper.
- `apps/web/components/run-views/timeline-view.tsx` — `'use client'` component. `TooltipProvider` wraps the whole view with delay=150. Uses `useMemo` for visible events, visible seq numbers, x-positions, time range, and scene boundaries. Exports `TimelineView`.
- `apps/web/components/run-views/run-view-tabs.tsx` — imports `TimelineView`, replaces the Timeline panel placeholder. `data-testid` attribute preserved.

## Decisions Made

- **TooltipTrigger `render` prop:** base-ui's Trigger supports a render prop that accepts already-wired trigger props and lets you render your own element. Using that form means the dot's `<button>` is itself the trigger — a single focusable, styleable, absolutely-positioned element. The alternative (default Trigger wrapping a nested button) would double the DOM and double the focus stops, which is noisy for a dense dot-lane.
- **Preview fallback `content.text ?? content.summary ?? ''`:** plan-proposal / artifact / question events don't have a `text` field. Using summary as the secondary source means Plan/Artifact cards still get a meaningful hover preview. Empty previews are suppressed in render (no dangling empty div).
- **Scrubber disabled on single-event runs:** `<input type="range" min={x} max={x}>` produces a no-op slider that still renders interactive — disabling it is clearer UX.
- **Scene labels above the lane, not inside it:** CONTEXT.md didn't specify placement beyond "scene dividers render as vertical divider lines with scene name labels". Above-lane placement keeps the 64px dot zone uncluttered and makes long labels (truncated at 24 chars) readable.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria pass:

- Task 1: 5 exports present (4 functions + 1 interface); 15 it() blocks; `span === 0` guard present; filter literals present; vitest imports present.
- Task 2: TimelineView exported; all 7 import sources present; `"Run has not started yet"` literal present; `type="range"` + `nearestEventBySeq` present; `getAgentColor(` call present; `setSelectedSeq(null)` Close-wiring present; `renderEvent(events[selectedSeq], runId)` exact literal present; `<TimelineView runId={runId} />` rendered in timeline panel; `data-testid="run-view-timeline"` preserved; placeholder string `"coming in 11-02"` absent; `pnpm exec tsc --noEmit` exits 0; `pnpm exec vitest run lib/timeline-utils.test.ts` 15/15 green.

## Issues Encountered

None.

## User Setup Required

None — no external service, env var, or infrastructure change. Manual UAT per CONTEXT.md §Testing happens after Phase 11 wraps (Plan 05 deploy + UAT).

## Next Phase Readiness

- Timeline tab is reachable at `/projects/:p/runs/:r?view=timeline` and behaves per CONTEXT.md §Timeline view.
- Writers' Room tab unchanged (TRAN-07 preserved; composer + header + drawer untouched).
- 11-03 (Boardroom) and 11-04 (Canvas) can proceed in parallel — they share nothing with Timeline beyond the already-shipped `renderEvent` + `getAgentColor` helpers.
- No backend changes, no SSE changes, no DB migrations — Timeline is 100% client-side over existing `useRunStore` state.

## Self-Check: PASSED

- `apps/web/lib/timeline-utils.ts` — FOUND
- `apps/web/lib/timeline-utils.test.ts` — FOUND
- `apps/web/components/run-views/timeline-view.tsx` — FOUND
- `apps/web/components/run-views/run-view-tabs.tsx` — MODIFIED (TimelineView import + panel wiring; placeholder removed)
- Commit `6ddb271` (test RED) — FOUND in `git log`
- Commit `e5b7f8d` (feat GREEN) — FOUND in `git log`
- Commit `bebb2ec` (feat Task 2) — FOUND in `git log`
- `pnpm exec vitest run lib/timeline-utils.test.ts` — 15/15 passed
- `pnpm exec vitest run` (full apps/web suite) — 33/33 passed
- `pnpm exec tsc --noEmit` — exit 0

---
*Phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas*
*Completed: 2026-04-22*
