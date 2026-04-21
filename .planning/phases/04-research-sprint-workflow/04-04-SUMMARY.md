---
phase: 04-research-sprint-workflow
plan: 04
subsystem: ui, state-management
tags: [zustand, tanstack-query, sse, eventsource, real-time, hooks]

requires:
  - phase: 04-research-sprint-workflow
    provides: Drizzle tenant schema (projects, runs, plans, questions, artifacts), state machine, Hub client, zustand/tanstack-query deps installed

provides:
  - Zustand run store with sequence-based dedup and derived selectors (plan, questions, artifacts, messages)
  - Zustand UI store for sidebar and active project/run state
  - EventSource SSE hook connecting real-time stream to Zustand
  - TanStack Query hooks for projects CRUD and runs listing
  - Mutation hooks for run lifecycle actions (approve, stop, answer, start, send)
  - QueryClientProvider wrapper for dashboard

affects: [04-05, 04-06]

tech-stack:
  added: []
  patterns: [zustand-normalized-event-store, tanstack-query-rest-hooks, eventsource-to-zustand-bridge, query-provider-wrapper]

key-files:
  created:
    - apps/web/lib/stores/run-store.ts
    - apps/web/lib/stores/ui-store.ts
    - apps/web/lib/hooks/use-sse.ts
    - apps/web/lib/hooks/use-projects.ts
    - apps/web/lib/hooks/use-run-actions.ts
    - apps/web/components/providers/query-provider.tsx
  modified: []

key-decisions:
  - "Used Record<number, HubEventEnvelope> instead of Map for events store (immer + Map compatibility concern from research A3)"
  - "Derived state (plan, unansweredQuestions, artifacts, messages) recomputed on each appendEvent for O(1) reads"
  - "useRuns fetches from /api/runs?projectId=X since per-project runs route does not exist yet"
  - "useSendMessage targets /api/runs/[id]/messages (route to be added in Plan 03 or future plan)"

patterns-established:
  - "Zustand store: normalized Record + eventOrder array + lastSequence for dedup"
  - "SSE hook: useEffect with EventSource, cleanup on unmount, initRun on runId change"
  - "TanStack Query: queryKey convention ['projects'] and ['projects', id, 'runs']"
  - "Mutation hooks: separate hook per action, invalidate relevant queries on success"

requirements-completed: [WORK-02, WORK-03, WORK-05, WORK-08]

duration: 2min
completed: 2026-04-21
---

# Phase 4 Plan 04: Client-Side State Layer Summary

**Zustand stores for real-time run events with sequence-based dedup, EventSource SSE hook, TanStack Query CRUD hooks, and QueryProvider -- complete client-side data layer for UI consumption**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-21T18:07:26Z
- **Completed:** 2026-04-21T18:09:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Zustand run store with normalized event storage, sequence-based dedup, and derived selectors for plan, unanswered questions, artifacts, and messages
- EventSource hook bridging SSE stream to Zustand with auto-reconnect via native EventSource behavior
- TanStack Query hooks for projects list, create project, and runs list with proper query invalidation
- Five mutation hooks covering the full run lifecycle (approve, stop, answer question, start run, send message)
- QueryProvider component ready to wrap the dashboard layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Zustand stores (run events + UI state)** - `c8b9fbf` (feat)
2. **Task 2: SSE hook + TanStack Query hooks + QueryProvider** - `3e48c6c` (feat)

## Files Created/Modified
- `apps/web/lib/stores/run-store.ts` - Zustand store: normalized events, sequence dedup, derived plan/questions/artifacts/messages
- `apps/web/lib/stores/ui-store.ts` - Zustand store: activeProjectId, activeRunId, sidebarOpen
- `apps/web/lib/hooks/use-sse.ts` - useRunStream hook connecting EventSource to Zustand appendEvent
- `apps/web/lib/hooks/use-projects.ts` - useProjects, useCreateProject, useRuns TanStack Query hooks
- `apps/web/lib/hooks/use-run-actions.ts` - useApproveRun, useStopRun, useAnswerQuestion, useStartRun, useSendMessage mutations
- `apps/web/components/providers/query-provider.tsx` - QueryClientProvider wrapper with 30s staleTime

## Decisions Made
- Used `Record<number, HubEventEnvelope>` instead of `Map` for events store to avoid immer + Map compatibility issues (research assumption A3)
- Derived state recomputed on each appendEvent call rather than using selectors -- simpler, no stale data risk
- `useRuns` fetches from `/api/runs?projectId=X` since a dedicated per-project runs route does not exist yet
- `useSendMessage` targets `/api/runs/[id]/messages` -- route to be added when implementing the composer flow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All stores and hooks ready for UI component consumption in Plans 05 and 06
- QueryProvider needs to be added to the dashboard layout (Plan 05 or 06 task)
- Two API routes referenced by hooks do not exist yet: `GET /api/runs?projectId=X` and `POST /api/runs/[id]/messages` -- these should be added when the corresponding UI is wired up

## Self-Check: PASSED

All 6 key files verified on disk. Both commits verified in git history.

---
*Phase: 04-research-sprint-workflow*
*Completed: 2026-04-21*
