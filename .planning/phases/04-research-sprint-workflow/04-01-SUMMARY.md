---
phase: 04-research-sprint-workflow
plan: 01
subsystem: database, api, ui
tags: [drizzle, shadcn, zustand, tanstack-query, ioredis, state-machine, hub-client]

requires:
  - phase: 01-foundation
    provides: pnpm monorepo, Drizzle tenant schema factory, TypeScript config
  - phase: 03-agent-connection-hub
    provides: Hub HTTP API, events table, Redis pub/sub, hub-events.ts message types

provides:
  - 6 domain model tables in tenant schema (projects, runs updated, plans, questions, artifacts, stateTransitions)
  - Run state machine (canTransition, assertTransition) with full D-07 transition validation
  - Hub HTTP client utility for Next.js API routes (send, startRun, stopRun, approveRun, answerQuestion)
  - shadcn/ui initialized with 10 components
  - Frontend deps installed (zustand, @tanstack/react-query, ioredis)
  - Backend dep installed (@aws-sdk/s3-request-presigner)

affects: [04-02, 04-03, 04-04, 04-05, 04-06]

tech-stack:
  added: [zustand@5.0.12, "@tanstack/react-query@5.99.2", ioredis@5.10.1, "@aws-sdk/s3-request-presigner@3.1033.0", vitest@4.1.5, shadcn/ui]
  patterns: [tenant-schema-factory-extension, run-state-machine-lookup-table, hub-client-internal-http]

key-files:
  created:
    - apps/web/lib/state-machine.ts
    - apps/web/lib/state-machine.test.ts
    - apps/web/lib/api/hub-client.ts
    - apps/web/components.json
    - apps/web/vitest.config.ts
    - apps/web/lib/utils.ts
    - apps/web/components/ui/*.tsx (10 shadcn components)
  modified:
    - packages/db/src/schema/tenant.ts
    - packages/db/package.json
    - apps/web/package.json
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx

key-decisions:
  - "Removed title column from runs table, replaced with projectId/kind/parentRunId/createdBy per D-02"
  - "State machine uses lookup table pattern (not xstate) for simplicity and testability"
  - "Hub client defaults to localhost:4100, overridable via AGENT_HUB_URL env var"
  - "shadcn init used base-nova style with Geist font and CSS variables"

patterns-established:
  - "State machine: VALID_TRANSITIONS record with canTransition/assertTransition guards"
  - "Hub client: typed hubPost wrapper with error extraction for internal HTTP calls"
  - "shadcn/ui: components in apps/web/components/ui/, utils in apps/web/lib/utils.ts"

requirements-completed: [WORK-01, WORK-02, WORK-08]

duration: 4min
completed: 2026-04-21
---

# Phase 4 Plan 01: Foundation Layer Summary

**6 domain tables (projects, runs, plans, questions, artifacts, state_transitions) in Drizzle tenant schema, run state machine with 11 passing tests, Hub HTTP client, shadcn/ui with 10 components, and all frontend/backend deps installed**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T18:00:04Z
- **Completed:** 2026-04-21T18:04:54Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments
- Extended tenant schema factory with 5 new tables and updated runs table per D-01 through D-06
- Run state machine validates all 6 valid transitions and rejects invalid ones (11 tests passing)
- Hub HTTP client ready for 5 endpoints (send, startRun, stopRun, approveRun, answerQuestion)
- shadcn/ui initialized with 10 components for Phase 4 UI work
- All dependencies installed: zustand, TanStack Query, ioredis, s3-request-presigner, vitest

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend tenant schema + install deps + init shadcn** - `9dd2c46` (feat)
2. **Task 2 RED: Failing state machine tests** - `7c19226` (test)
3. **Task 2 GREEN: State machine + Hub client implementation** - `a8cff9f` (feat)

## Files Created/Modified
- `packages/db/src/schema/tenant.ts` - 6 domain tables: projects, runs (updated), plans, questions, artifacts, stateTransitions
- `apps/web/lib/state-machine.ts` - Run lifecycle state machine with canTransition/assertTransition
- `apps/web/lib/state-machine.test.ts` - 11 test cases covering all D-07 transitions
- `apps/web/lib/api/hub-client.ts` - Typed HTTP client for Hub internal API
- `apps/web/components.json` - shadcn/ui configuration
- `apps/web/components/ui/*.tsx` - 10 shadcn components (button, card, input, textarea, badge, dialog, scroll-area, separator, skeleton, tooltip)
- `apps/web/vitest.config.ts` - Vitest configuration with path aliases
- `apps/web/lib/utils.ts` - shadcn utility (cn function)
- `apps/web/app/globals.css` - Updated with shadcn CSS variables
- `apps/web/app/layout.tsx` - Updated with Geist font from shadcn init
- `packages/db/package.json` - Added @aws-sdk/s3-request-presigner
- `apps/web/package.json` - Added zustand, @tanstack/react-query, ioredis, vitest

## Decisions Made
- Removed `title` column from runs table, replaced with `projectId`, `kind`, `parentRunId`, `createdBy` per D-02
- State machine uses simple lookup table pattern (not xstate) -- sufficient for 6 states, fully testable
- Hub client defaults to `localhost:4100`, overridable via `AGENT_HUB_URL` env var for Docker networking
- shadcn init chose base-nova style with Geist font; all CSS variables compatible with existing dark theme

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed vitest for TDD task**
- **Found during:** Task 2 (TDD RED phase)
- **Issue:** vitest not installed in apps/web, required for running tests
- **Fix:** `pnpm add -D vitest`, created `vitest.config.ts` with path alias resolution
- **Files modified:** apps/web/package.json, apps/web/vitest.config.ts
- **Verification:** All 11 tests run and pass
- **Committed in:** 7c19226 (Task 2 RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Vitest installation was implied by the plan's TDD requirement. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 domain tables ready for API routes (Plan 02) and SSE streaming (Plan 03)
- State machine ready for server-side transition validation in API routes
- Hub client ready for use in Next.js API routes
- shadcn components ready for UI development (Plans 04-06)
- Vitest configured for additional tests in subsequent plans

## Self-Check: PASSED

All 6 key files verified on disk. All 3 commits verified in git history.

---
*Phase: 04-research-sprint-workflow*
*Completed: 2026-04-21*
