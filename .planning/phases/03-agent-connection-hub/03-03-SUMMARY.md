---
phase: 03-agent-connection-hub
plan: 03
subsystem: agent-hub
tags: [event-store, redis-pubsub, ioredis, sequence-counter, message-router, http-api, zod-validation]

requires:
  - phase: 03-agent-connection-hub
    plan: 01
    provides: HubEventEnvelope types, events table schema, agent connection layer, AgentRegistry, HTTP server skeleton
provides:
  - SequenceCounter with per-run monotonic numbering and DB recovery
  - EventStore persisting events to tenant schema events table
  - RedisPublisher publishing to run:{tenantId}:{runId} channels
  - MessageRouter mapping OpenClaw messages to HubEventEnvelope with persist-before-publish
  - HTTP API routes POST /send, /runs/start, /runs/stop with Zod validation
  - Full Hub wiring with active run context management
affects: [05-sse-transcript, 04-run-state-machine]

tech-stack:
  added: [drizzle-orm]
  patterns: [persist-before-publish, per-run-sequence-counter, openclaw-message-mapping, zod-body-validation]

key-files:
  created:
    - apps/agent-hub/src/events/sequence-counter.ts
    - apps/agent-hub/src/events/event-store.ts
    - apps/agent-hub/src/bridge/redis-client.ts
    - apps/agent-hub/src/bridge/redis-publisher.ts
    - apps/agent-hub/src/handlers/message-router.ts
    - apps/agent-hub/src/http/routes.ts
    - apps/agent-hub/src/__tests__/sequence-counter.test.ts
    - apps/agent-hub/src/__tests__/reconnect.test.ts
    - apps/agent-hub/src/__tests__/message-router.test.ts
  modified:
    - apps/agent-hub/src/index.ts
    - apps/agent-hub/package.json

key-decisions:
  - "Added drizzle-orm as direct dependency in agent-hub for sequence counter DB queries"

patterns-established:
  - "Persist-before-publish: EventStore.persist() must succeed before RedisPublisher.publish() (D-08)"
  - "Per-run sequence counter: in-memory Map with DB MAX(sequence_number) recovery on first access (D-09)"
  - "Redis channel naming: run:{tenantId}:{runId} for tenant-scoped pub/sub (D-10)"
  - "OpenClaw message mapping: chat.response/stream -> agent_message, chat.typing/error -> system"
  - "Zod body validation on all POST routes with 400 response on invalid input (T-03-07)"

requirements-completed: [CONN-03, CONN-05, CONN-06]

duration: 4min
completed: 2026-04-21
---

# Phase 3 Plan 3: Event Pipeline & HTTP API Summary

**Event persistence with monotonic sequence numbering, Redis pub/sub bridge, OpenClaw message routing, and HTTP API for run control (/send, /runs/start, /runs/stop)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T17:31:28Z
- **Completed:** 2026-04-21T17:35:40Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Complete event pipeline: agent message -> Zod parse -> map to envelope -> sequence number -> persist to PostgreSQL -> publish to Redis
- Three HTTP API routes with Zod body validation: POST /send relays user messages, POST /runs/start initiates runs, POST /runs/stop cancels runs
- Persist-before-publish invariant enforced throughout (D-08) -- verified by unit test checking call ordering
- 16 unit tests covering sequence counter, backoff logic, message mapping, pipeline ordering, and invalid message handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Event persistence layer** - `bc6bb1d` (feat) -- TDD: sequence counter, event store, Redis publisher, unit tests
2. **Task 2: Message router, HTTP API, Hub wiring** - `94d6caa` (feat) -- TDD: message router, HTTP routes, full index.ts wiring

## Files Created/Modified
- `apps/agent-hub/src/events/sequence-counter.ts` - Per-run monotonic counter with Map + DB recovery
- `apps/agent-hub/src/events/event-store.ts` - Persists events to tenant schema, assigns sequence + timestamp
- `apps/agent-hub/src/bridge/redis-client.ts` - ioredis publisher instance with lazyConnect, graceful shutdown
- `apps/agent-hub/src/bridge/redis-publisher.ts` - Publishes HubEventEnvelope to run:{tenantId}:{runId} channels
- `apps/agent-hub/src/handlers/message-router.ts` - Maps OpenClaw messages to envelopes, orchestrates persist->publish pipeline
- `apps/agent-hub/src/http/routes.ts` - handleSend, handleRunStart, handleRunStop with Zod validation
- `apps/agent-hub/src/index.ts` - Full wiring: EventStore, RedisPublisher, MessageRouter, active run context, graceful shutdown
- `apps/agent-hub/src/__tests__/sequence-counter.test.ts` - 5 tests for monotonic sequencing
- `apps/agent-hub/src/__tests__/reconnect.test.ts` - 4 tests for backoff logic
- `apps/agent-hub/src/__tests__/message-router.test.ts` - 7 tests for mapping, ordering, error handling

## Decisions Made
- Added drizzle-orm as direct dependency in agent-hub for SequenceCounter DB queries (it was already an indirect dep through @beagle-console/db)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added drizzle-orm direct dependency**
- **Found during:** Task 1 (sequence-counter.ts)
- **Issue:** sequence-counter.ts imports `eq` and `sql` from drizzle-orm, but drizzle-orm was only an indirect dependency through @beagle-console/db -- Vitest could not resolve it
- **Fix:** `pnpm add drizzle-orm` in apps/agent-hub
- **Files modified:** apps/agent-hub/package.json, pnpm-lock.yaml
- **Verification:** All tests pass, TypeScript compiles clean
- **Committed in:** bc6bb1d

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for module resolution. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent Connection Hub is now fully functional: connects to agents, routes messages through event pipeline, publishes to Redis
- POST endpoints are live (/send, /runs/start, /runs/stop) -- Next.js can call them once Phase 5 SSE is built
- Hub tracks a single active run context -- multi-tenant concurrent runs deferred to Phase 4 (run state machine)
- Redis channels are ready for Phase 5 SSE subscription

## Self-Check: PASSED

- All 9 created files verified present
- Both task commits (bc6bb1d, 94d6caa) verified in git log
- 16/16 tests pass
- TypeScript compiles clean

---
*Phase: 03-agent-connection-hub*
*Completed: 2026-04-21*
