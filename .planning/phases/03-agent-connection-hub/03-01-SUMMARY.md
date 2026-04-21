---
phase: 03-agent-connection-hub
plan: 01
subsystem: agent-hub
tags: [websocket, ws, pino, ioredis, zod, openclaw, reconnection, backoff]

requires:
  - phase: 01-foundation
    provides: monorepo scaffold, agent-hub skeleton, shared package, db package, docker-compose
provides:
  - HubEventEnvelope, MessageType, OpenClawInbound, OpenClawOutbound Zod schemas
  - Events table in tenant schema with composite unique index
  - Agent connection layer with reconnect, ping/pong, capped outbound queue
  - AgentRegistry tracking connection state per agent
  - HTTP /health and /status endpoints
  - Zod-validated environment config
  - Pino structured logging
affects: [03-agent-connection-hub, 05-sse-transcript]

tech-stack:
  added: [ioredis, pino, pino-pretty]
  patterns: [managed-connection-wrapper, exponential-backoff-jitter, agent-registry-pattern, zod-env-config]

key-files:
  created:
    - packages/shared/src/hub-events.ts
    - apps/agent-hub/src/config.ts
    - apps/agent-hub/src/logger.ts
    - apps/agent-hub/src/connections/reconnect.ts
    - apps/agent-hub/src/connections/managed-connection.ts
    - apps/agent-hub/src/connections/agent-registry.ts
  modified:
    - packages/shared/src/index.ts
    - packages/db/src/schema/tenant.ts
    - apps/agent-hub/src/index.ts
    - apps/agent-hub/package.json
    - docker/docker-compose.yml

key-decisions:
  - "zod/v4 z.record requires (key, value) args -- used z.record(z.string(), z.unknown())"
  - "Added zod as direct dep in agent-hub for config validation (same pattern as apps/web)"

patterns-established:
  - "ManagedConnection: ws wrapper with ping/pong, reconnect on close only (not error), capped outbound queue"
  - "AgentRegistry: centralized connection management with state tracking and health aggregation"
  - "Zod env config: parse process.env with coerce for numbers, defaults for optional values"
  - "Pino child loggers: createChildLogger(bindings) for per-component/per-agent logging"

requirements-completed: [CONN-01, CONN-04]

duration: 3min
completed: 2026-04-21
---

# Phase 3 Plan 1: Hub Connection Foundation Summary

**WebSocket connection layer with ManagedConnection wrappers, exponential backoff reconnection, agent registry, and shared Zod message schemas for OpenClaw protocol**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T17:24:16Z
- **Completed:** 2026-04-21T17:27:55Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Shared Zod schemas for Hub event envelope and OpenClaw WebSocket protocol (inbound + outbound)
- Events table with composite unique index on (run_id, sequence_number) in tenant schema
- Full agent connection layer: ManagedConnection with ping/pong heartbeat, exponential backoff + jitter reconnection, and capped outbound queue
- AgentRegistry tracks all agent connections with health/status aggregation
- HTTP server with /health and /status endpoints; POST placeholders return 501 for Plan 03

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types, events schema, and dependencies** - `6f2e427` (feat)
2. **Task 2: Hub connection layer** - `cb8b6c5` (feat)

## Files Created/Modified
- `packages/shared/src/hub-events.ts` - HubEventEnvelope, MessageType, OpenClawInbound, OpenClawOutbound Zod schemas
- `packages/shared/src/index.ts` - Re-exports hub-events; AgentName extended with sam, herman
- `packages/db/src/schema/tenant.ts` - Events table with composite unique index
- `apps/agent-hub/src/config.ts` - Zod-validated environment config with agent URL array
- `apps/agent-hub/src/logger.ts` - Pino logger with child logger factory
- `apps/agent-hub/src/connections/reconnect.ts` - calculateBackoff + ConnectionState type
- `apps/agent-hub/src/connections/managed-connection.ts` - WebSocket lifecycle: connect, ping/pong, reconnect, send with queue
- `apps/agent-hub/src/connections/agent-registry.ts` - Agent connection map with health/status
- `apps/agent-hub/src/index.ts` - HTTP server with routes, registry init, graceful shutdown
- `apps/agent-hub/package.json` - Added ioredis, pino, zod deps
- `docker/docker-compose.yml` - Agent URL env vars for Mo, Sam, Herman

## Decisions Made
- zod/v4 `z.record` requires two arguments (key schema, value schema) -- used `z.record(z.string(), z.unknown())` instead of single-arg form
- Added zod as direct dependency in agent-hub for config module (same pattern established in Phase 2 for apps/web)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zod/v4 z.record signature**
- **Found during:** Task 1 (hub-events.ts)
- **Issue:** Plan examples used `z.record(z.unknown())` but zod v4 requires two args
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** packages/shared/src/hub-events.ts
- **Verification:** `pnpm exec tsc --noEmit -p packages/shared/tsconfig.json` passes
- **Committed in:** 6f2e427

**2. [Rule 3 - Blocking] Added zod dependency to agent-hub**
- **Found during:** Task 2 (config.ts)
- **Issue:** config.ts imports zod/v4 but zod was not a direct dependency of agent-hub
- **Fix:** `pnpm add zod` in apps/agent-hub
- **Files modified:** apps/agent-hub/package.json, pnpm-lock.yaml
- **Verification:** `pnpm exec tsc --noEmit -p apps/agent-hub/tsconfig.json` passes
- **Committed in:** cb8b6c5

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Connection layer complete, ready for Plan 02 (OpenClaw plugin deployment) and Plan 03 (event persistence + Redis bridge)
- POST /send, /runs/start, /runs/stop endpoints are 501 placeholders awaiting Plan 03 wiring
- Events table schema defined but not yet migrated to database (migration runs on deployment)

---
*Phase: 03-agent-connection-hub*
*Completed: 2026-04-21*
