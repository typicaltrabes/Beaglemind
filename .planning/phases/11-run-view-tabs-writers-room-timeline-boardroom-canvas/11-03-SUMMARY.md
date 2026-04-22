---
phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas
plan: 03
subsystem: ui

tags:
  - boardroom
  - per-agent-columns
  - accordion
  - run-view
  - clean-studio
  - responsive

# Dependency graph
requires:
  - phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas
    provides: Tabs primitive, getAgentColor, renderEvent, RunViewTabs placeholder panel with data-testid="run-view-boardroom"
  - phase: 05-transcript-ui
    provides: AgentMessage, PlanCard, QuestionCard, ArtifactCard (consumed via renderEvent)
  - phase: 06-clean-studio-modes
    provides: useMode (clean/studio) — drives Boardroom event filter + run-level replication

provides:
  - BoardroomView component (components/run-views/boardroom-view.tsx)
  - boardroom-utils pure helpers (lib/boardroom-utils.ts) — filterBoardroomEvents, groupEventsByAgent + AgentColumn type
  - 12 vitest assertions covering clean/studio filtering, first-appearance ordering, sequence sorting, user column, studio replication, empty-run edge cases
  - Boardroom TabsPanel wired: placeholder replaced with <BoardroomView runId={runId} />

affects:
  - 11-04-PLAN (Canvas — same integration surface, remains the only placeholder panel)
  - 11-05-PLAN (deploy + UAT — Boardroom ready for manual check)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'CSS grid with grid-auto-flow: column + grid-auto-columns: minmax(280px, 1fr) for equal-width agent columns that never shrink below 280px'
    - 'overflow-x-auto outer wrapper on desktop grid so 5+ agent runs scroll horizontally instead of cramping'
    - 'Desktop/mobile layout split via hidden md:grid sibling + md:hidden accordion sibling — no JS media query'
    - 'Each column body: flex-1 min-h-0 overflow-y-auto so columns scroll independently with no auto-scroll-to-bottom'
    - 'Mobile accordion: one Collapsible per agent column, default-open, chevron rotates 180deg when closed'
    - 'Run-level state_transition replication: groupEventsByAgent pushes each transition into every agent column in studio mode, then sorts the whole column by sequenceNumber so transitions land at their correct chronological position'
    - 'Unconditional sort-by-sequence on every column regardless of input order — callers rely on it for chronological rendering'

key-files:
  created:
    - apps/web/lib/boardroom-utils.ts
    - apps/web/lib/boardroom-utils.test.ts
    - apps/web/components/run-views/boardroom-view.tsx
  modified:
    - apps/web/components/run-views/run-view-tabs.tsx

key-decisions:
  - "Columns include only agentIds with at least one non-state_transition event — a run with only state_transition events produces 0 columns in both clean and studio modes, matching the 'No agent activity yet' empty state. This is intentional per plan spec to avoid phantom empty columns."
  - "Column events sorted ascending by sequenceNumber unconditionally (not only when replicating run-level events) — the plan's behavior spec lists sort-by-seq as a column invariant, and callers rely on it"
  - "Desktop vs mobile split done with tailwind responsive classes (hidden md:grid + md:hidden) rather than a JS matchMedia hook — simpler, works during SSR, no hydration mismatch risk"
  - "Mobile accordion sections default to open (useState(true)) — empty-by-default would hide activity on first load, which defeats the purpose of the tab"
  - "Desktop columns use border-r border-white/10 last:border-r-0 for subtle vertical separators that match the overall dark theme without drawing attention"
  - "Agent header reuses the same swatch + displayName + role layout for both desktop and mobile so the two code paths feel like the same component in different containers"

patterns-established:
  - "boardroom-utils as a sibling of timeline-utils and state-machine — pure data-shaping helpers live in lib/ with colocated vitest coverage"
  - "Per-tab view component pattern continues: (runId: string) → ReactNode, reads useRunStore + useMode directly, owns its responsive layout"
  - "Replication-then-sort for run-level events: when an event belongs to every column, push it into each and sort once per column rather than merging sorted streams"

requirements-completed:
  - VIEW-02

# Metrics
duration: 3min
completed: 2026-04-22
---

# Phase 11 Plan 03: Boardroom View Summary

**VIEW-02 Boardroom tab: parallel per-agent columns (desktop CSS grid, mobile accordion) reading useRunStore.messages, with Clean/Studio filtering and run-level state_transition replication — all client-side, no backend changes.**

## Performance

- **Duration:** ~3 min (191s)
- **Started:** 2026-04-22T12:55:27Z
- **Completed:** 2026-04-22T12:58:38Z
- **Tasks:** 2 (Task 1 executed as TDD RED → GREEN; Task 2 as feat)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Two pure helpers (`filterBoardroomEvents`, `groupEventsByAgent`) + `AgentColumn` type in `apps/web/lib/boardroom-utils.ts`.
- 12 vitest assertions in `apps/web/lib/boardroom-utils.test.ts` covering every behavior bullet from the plan (mode-aware filtering, first-appearance ordering, seq-asc sorting, user-column-as-normal, studio replication exactly-once, empty-run / only-state_transition edge cases in both modes, sentinel_flag handling in clean vs studio).
- `BoardroomView` component at `apps/web/components/run-views/boardroom-view.tsx`:
  - Reads `messages` from `useRunStore` and `mode` from `useMode`.
  - `useMemo`-wrapped `groupEventsByAgent(messages, mode)` drives the column list.
  - Desktop: CSS grid (`grid-auto-flow: column` + `grid-auto-columns: minmax(280px, 1fr)`) inside `overflow-x-auto` — equal-width columns that scroll horizontally on many-agent runs.
  - Mobile (<768px): `md:hidden` accordion of `Collapsible` sections, one per agent, default-open with rotating chevron.
  - Column header: `getAgentColor` swatch + `getAgentConfig().displayName` + optional role (muted).
  - Column body reuses shared `renderEvent(event, runId)` helper so rendering matches Writers' Room / Timeline exactly.
  - Each column body is `flex-1 min-h-0 overflow-y-auto` — scrolls independently; no auto-scroll-to-bottom.
  - Empty state `"No agent activity yet"` when `columns.length === 0`.
- `run-view-tabs.tsx` wired: Boardroom panel placeholder replaced with `<BoardroomView runId={runId} />`; `data-testid="run-view-boardroom"` preserved; Timeline (11-02) and Canvas (11-04) panels untouched.
- Full apps/web vitest suite stays green (45/45, up from 33/33 after the 12 new boardroom-utils assertions) and `pnpm exec tsc --noEmit` exits 0.

## Task Commits

1. **Task 1 (RED):** `2a9e53f` — `test(11-03)` failing tests for boardroom-utils helpers (module does not yet exist).
2. **Task 1 (GREEN):** `996ede5` — `feat(11-03)` implement boardroom-utils pure helpers; 12/12 tests pass.
3. **Task 2:** `fb30ddf` — `feat(11-03)` implement BoardroomView and wire into run-view tabs.

_Task 1 followed the TDD gate (RED then GREEN); no REFACTOR commit was needed — the second iteration extracted the column sort out of the replication branch to satisfy the unconditional-sort-by-seq invariant, and that was done inside the same GREEN step before commit. Task 2 did not create a new test file (the plan's `<verify>` for Task 2 is `tsc --noEmit`; behavioral coverage lives in the pure helpers)._

## Files Created/Modified

- `apps/web/lib/boardroom-utils.ts` — `filterBoardroomEvents(messages, mode)` and `groupEventsByAgent(messages, mode): AgentColumn[]`. 76 lines. No React imports. Unconditional sort-by-sequence on every column; run-level events replicated into every column in studio mode.
- `apps/web/lib/boardroom-utils.test.ts` — 12 `it(...)` blocks across 2 `describe(...)` suites. Uses a `mkEvent()` fixture helper with per-seq timestamps.
- `apps/web/components/run-views/boardroom-view.tsx` — `'use client'` component. Exports `BoardroomView`. Inner `AgentHeader`, `ColumnBody`, and `MobileAgentSection` helpers keep the desktop/mobile bodies symmetric. Uses `useState` only on the mobile accordion (open/closed per section).
- `apps/web/components/run-views/run-view-tabs.tsx` — imports `BoardroomView`, replaces the Boardroom panel placeholder. Import line added alongside existing `WritersRoomView` + `TimelineView` imports. All other panels (Writers' Room / Timeline / Canvas) and the tab switcher logic untouched.

## Decisions Made

- **Unconditional column sort:** The plan's behavior spec lists "Each column's events are sorted ascending by sequenceNumber" as a column invariant. The first implementation sorted only when run-level events were replicated (studio mode), which failed the sort-out-of-order-input test. Moving the sort out of the replication branch to run on every column means the invariant holds in both clean and studio mode regardless of input order — callers can rely on it for chronological rendering without doing their own sort. Cost is one `Array.sort` per agent per recompute; columns are small (a few dozen events in year-1 runs), so this is free.
- **0 columns when run has only state_transition:** Both clean and studio mode produce 0 columns when the run contains only run-level events. In clean mode this is natural (filter drops them). In studio mode the replication step has no columns to replicate into, so it's a no-op and the column list stays empty. This matches the plan spec — "No agent activity yet" is the correct user-facing state, not a row of empty columns.
- **Default-open mobile accordion:** Collapsing all agents on first load would hide activity from the user. The tab's purpose is parallel viewing, so open-by-default with the option to collapse specific agents is the right UX.
- **Desktop/mobile via tailwind classes, not JS:** `hidden md:grid` + `md:hidden` siblings render both DOM trees and let CSS pick one. No `matchMedia` hook, no hydration mismatch risk, works during SSR. Cost is marginal: the two trees share the same `useMemo` columns array, so only the DOM differs.
- **Border vs divider:** Desktop columns use `border-r border-white/10 last:border-r-0` instead of explicit divider elements — one class, visually indistinguishable, keeps the column DOM flat.

## Deviations from Plan

**[Rule 1 — Bug] First GREEN attempt failed sort-by-seq invariant**

- **Found during:** Task 1 GREEN (running tests for the first implementation)
- **Issue:** The plan's reference implementation only sorted each column when run-level events were replicated (inside `if (runLevelEvents.length > 0)`), which meant clean-mode columns with out-of-order input stayed unsorted. The unit test "sorts column events ascending by sequenceNumber even if input is out of order" failed 5,1,3 vs expected 1,3,5.
- **Fix:** Moved the per-column sort out of the replication branch. Now every column is sorted ascending by `sequenceNumber` in a final pass regardless of mode. The behavior spec lists this as a column invariant ("Each column's events are sorted ascending by sequenceNumber"), so the fix aligns the implementation with the documented behavior.
- **Files modified:** `apps/web/lib/boardroom-utils.ts`
- **Commit:** `996ede5` (the fix was applied in the same GREEN step, before commit)

No other deviations. All acceptance criteria pass verbatim.

## Issues Encountered

None beyond the Rule 1 bug above — which surfaced via the test suite, was fixed in-step, and produced a clean GREEN on the next run.

## User Setup Required

None — no external service, env var, or infrastructure change. Manual UAT per CONTEXT.md §Testing happens after Phase 11 wraps (Plan 05 deploy + UAT).

## Next Phase Readiness

- Boardroom tab is reachable at `/projects/:p/runs/:r?view=boardroom` and behaves per CONTEXT.md §Boardroom view.
- Writers' Room and Timeline tabs unchanged — no regression introduced (verified via full vitest suite green + tsc green).
- 11-04 (Canvas) can proceed — it shares nothing with Boardroom beyond the already-shipped `renderEvent` helper; it drops into the last remaining placeholder (`data-testid="run-view-canvas"`).
- No backend changes, no SSE changes, no DB migrations — Boardroom is 100% client-side over existing `useRunStore` state.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. T-11-07 (XSS via display name) remains mitigated by reading from the hard-coded `AGENT_CONFIG` map and rendering the result as a React text node. T-11-08 (clean-mode leak) is covered by the `filterBoardroomEvents` unit tests (both `sentinel_flag` and `state_transition` are dropped in clean mode). T-11-09 (wide grid DoS) accepted per plan.

## Self-Check: PASSED

- `apps/web/lib/boardroom-utils.ts` — FOUND
- `apps/web/lib/boardroom-utils.test.ts` — FOUND
- `apps/web/components/run-views/boardroom-view.tsx` — FOUND
- `apps/web/components/run-views/run-view-tabs.tsx` — MODIFIED (BoardroomView import + panel wiring; `coming in 11-03` placeholder removed)
- Commit `2a9e53f` (test RED) — FOUND in `git log`
- Commit `996ede5` (feat GREEN) — FOUND in `git log`
- Commit `fb30ddf` (feat Task 2) — FOUND in `git log`
- `pnpm exec vitest run lib/boardroom-utils.test.ts` — 12/12 passed
- `pnpm exec vitest run` (full apps/web suite) — 45/45 passed
- `pnpm exec tsc --noEmit` — exit 0
- Timeline (11-02) panel body untouched — regression-free
- Canvas (11-04) placeholder preserved — wave-2 sibling plan can drop in without merge conflict

---
*Phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas*
*Completed: 2026-04-22*
