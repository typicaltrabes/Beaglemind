---
phase: 04-research-sprint-workflow
plan: 02
subsystem: api
tags: [websocket, hub, zod, http-routes, state-machine, agent-communication]

requires:
  - phase: 03-agent-connection-hub
    provides: "Hub HTTP server, routes.ts, index.ts, MessageRouter, AgentRegistry, EventStore"
provides:
  - "POST /runs/approve route handler (handleRunApprove)"
  - "POST /runs/questions/answer route handler (handleQuestionAnswer)"
  - "Fixed run lifecycle: no premature pending->executing transition"
affects: [04-research-sprint-workflow, next-js-api-routes]

tech-stack:
  added: []
  patterns:
    - "Hub route handler pattern: Zod parse -> construct outbound -> registry.send -> router.persistAndPublish"
    - "State transition pairs: user-triggered (planned->approved) followed by system-triggered (approved->executing)"

key-files:
  created: []
  modified:
    - apps/agent-hub/src/http/routes.ts
    - apps/agent-hub/src/index.ts
    - packages/shared/src/hub-events.ts

key-decisions:
  - "Extended OpenClawOutbound customData with catchall to allow questionId in answer messages"
  - "handleRunStart no longer publishes state_transition; Mo's plan_proposal drives lifecycle"

patterns-established:
  - "Approval flow: user approve -> Hub sends signal to Mo + publishes planned->approved + approved->executing"
  - "Question answer flow: user answer -> Hub forwards to asking agent + persists user answer event"

requirements-completed: [WORK-04, WORK-06, WORK-08]

duration: 2min
completed: 2026-04-21
---

# Phase 4 Plan 02: Hub API Fixes Summary

**Added /runs/approve and /runs/questions/answer Hub routes, fixed /runs/start to not skip planned->approved lifecycle**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-21T18:00:09Z
- **Completed:** 2026-04-21T18:02:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Hub now serves all 5 HTTP routes: /send, /runs/start, /runs/stop, /runs/approve, /runs/questions/answer
- Plan approval sends signal to Mo and publishes planned->approved->executing state transitions
- Question answer forwards to the asking agent and persists user answer event
- Removed incorrect pending->executing transition from /runs/start (Mo drives lifecycle via plan_proposal)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add handleRunApprove and handleQuestionAnswer to Hub routes** - `61e98ea` (feat)
2. **Task 2: Wire new routes into Hub HTTP server** - `bcba2b4` (feat)

## Files Created/Modified
- `apps/agent-hub/src/http/routes.ts` - Added handleRunApprove, handleQuestionAnswer; removed pending->executing from handleRunStart
- `apps/agent-hub/src/index.ts` - Wired /runs/approve and /runs/questions/answer routes
- `packages/shared/src/hub-events.ts` - Extended OpenClawOutbound customData with catchall for additional fields

## Decisions Made
- Extended OpenClawOutbound customData Zod schema with `.catchall(z.unknown())` to allow passing questionId in answer messages without breaking existing type safety for runId/tenantId
- handleRunStart no longer publishes any state_transition -- the run stays as `pending` until Mo sends a plan_proposal, which triggers pending->planned in the Next.js layer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended OpenClawOutbound customData type**
- **Found during:** Task 1 (handleQuestionAnswer implementation)
- **Issue:** OpenClawOutbound customData was strictly typed as `{ runId: string, tenantId: string }`, but plan requires passing questionId in customData for answer messages
- **Fix:** Added `.catchall(z.unknown())` to the customData Zod schema in hub-events.ts, allowing additional fields while preserving required field validation
- **Files modified:** packages/shared/src/hub-events.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** 61e98ea (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal type widening necessary for question answer flow. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hub API is complete for all Phase 4 command paths
- Next.js API routes can now call /runs/approve and /runs/questions/answer on the Hub
- SSE streaming, Zustand store, and UI components can proceed in subsequent plans

---
*Phase: 04-research-sprint-workflow*
*Completed: 2026-04-21*
