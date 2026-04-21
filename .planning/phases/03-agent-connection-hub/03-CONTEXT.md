# Phase 3: Agent Connection Hub - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Agent Connection Hub — a Node WebSocket service that maintains persistent connections to OpenClaw agents on the Agents VPS, assigns monotonic sequence numbers to all messages, persists events to PostgreSQL, and publishes to Redis pub/sub for consumption by Next.js SSE endpoints.

This phase does NOT build the browser-facing SSE endpoints or the transcript UI — those are Phase 5. This phase builds the server-side infrastructure that connects to agents and makes messages available.

</domain>

<decisions>
## Implementation Decisions

### OpenClaw Agent Connections
- **D-01:** Hub connects as a WebSocket client to each agent's OpenClaw instance on the Agents VPS (46.225.56.122): Mo on port 18789, Sam on port 18790, Herman on port 19000.
- **D-02:** Console channel plugin built for OpenClaw v2026.3.2 — adds a "console" channel alongside existing WhatsApp channel. Plugin receives messages from Hub, sends agent responses back through the same WebSocket.
- **D-03:** Agent connection registry: `Map<agentId, WebSocket>` in the Hub process. Tracks connection state (connected/disconnecting/reconnecting).
- **D-04:** Reconnection with exponential backoff + jitter: base 1s, max 30s, jitter factor 0.5. Reconnects automatically on connection drop.

### Message Envelope
- **D-05:** Standard JSON message envelope for all Hub↔Agent communication:
  ```json
  {
    "type": "agent_message|plan_proposal|question|artifact|state_transition|system",
    "agentId": "mo|jarvis|sam|herman",
    "runId": "uuid",
    "tenantId": "uuid",
    "content": {},
    "metadata": {},
    "timestamp": "ISO-8601"
  }
  ```
  Hub assigns `sequenceNumber` (monotonic per run) before persistence and broadcast.
- **D-06:** Message types: `agent_message` (chat), `plan_proposal` (plan for approval), `question` (clarification request), `artifact` (file delivery), `state_transition` (run state change), `system` (connect/disconnect/error/heartbeat).

### Event Persistence
- **D-07:** Append-only events table in tenant schema: `id` (serial), `run_id` (uuid FK), `sequence_number` (integer), `type` (text), `agent_id` (text), `content` (jsonb), `metadata` (jsonb), `created_at` (timestamptz). Composite index on `(run_id, sequence_number)`.
- **D-08:** Events persisted to PostgreSQL BEFORE broadcasting to Redis. If persistence fails, message is not broadcast (consistency over availability).
- **D-09:** Monotonic sequence numbers are per-run, assigned by the Hub using an in-memory counter + database sequence as fallback. Counter resets when a new run starts.

### Redis Pub/Sub
- **D-10:** Channel naming: `run:{tenantId}:{runId}` — one channel per active run. Next.js SSE endpoints subscribe to the relevant channel.
- **D-11:** Published message includes the full event envelope + sequenceNumber. Subscribers use sequence numbers for ordering and reconnect catch-up.
- **D-12:** Hub publishes to Redis on the beaglehq_backend network (existing Redis instance).

### Hub Service Architecture
- **D-13:** Single Node process using `ws` library (not Socket.IO for agent connections — raw WebSocket is simpler for server-to-server).
- **D-14:** Hub exposes an internal HTTP API for the Next.js app to send user messages to agents (POST /send, POST /runs/start, POST /runs/stop). Not exposed externally — only accessible within Docker network.
- **D-15:** Health check endpoint at GET /health for Docker healthcheck.
- **D-16:** Hub reads agent connection config from environment variables (AGENT_MO_URL, AGENT_SAM_URL, etc.).

### Claude's Discretion
- Exact OpenClaw console channel plugin implementation details
- ws library configuration (ping/pong intervals, max payload size)
- Redis connection pooling configuration
- Internal HTTP API framework choice (plain http, express, fastify — keep it minimal)
- Heartbeat interval for agent connections
- Logging library and format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Document
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260417 Beagle Agent Console — Design Doc v3.md` — §12 system architecture (Agent Connection Hub)

### Research
- `.planning/research/ARCHITECTURE.md` — Hub-and-spoke pattern, message flow, sequence numbering
- `.planning/research/PITFALLS.md` — WebSocket reconnection storms, message ordering, Redis SPOF
- `.planning/research/STACK.md` — ws@8, ioredis, event store patterns

### Infrastructure
- BeagleHQ CLAUDE.md (`~/.claude/projects/-Users-lucastraber/CLAUDE.md`) — Agent VPS details, OpenClaw config locations, agent container names
- Agents VPS: Mo at 46.225.56.122:18789, Sam at :18790, Herman at :19000
- OpenClaw global install at /usr/lib/node_modules/openclaw/ on Agents VPS

### Existing Code
- `apps/agent-hub/` — Skeleton from Phase 1 (entry point + Dockerfile)
- `packages/db/src/schema/tenant.ts` — Tenant schema factory (extend with events table)
- `packages/db/src/connection.ts` — Database connection pool
- `packages/shared/` — Shared Zod types (add message envelope schema)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent-hub/src/index.ts` — Bare entry point, needs full implementation
- `apps/agent-hub/Dockerfile` — Multi-stage build ready
- `packages/db` — Drizzle ORM with tenant utilities, connection pool
- `packages/shared` — Zod types package (add message envelope validation)
- Redis available on beaglehq_backend Docker network

### Established Patterns
- Drizzle `createTenantSchema(tenantId)` factory — extend with events table
- `getTenantDb(tenantId)` for scoped database access
- pnpm workspace cross-references between packages

### Integration Points
- Hub container on beaglehq_backend (Postgres, Redis) + needs outbound access to Agents VPS (46.225.56.122)
- Next.js app calls Hub's internal HTTP API to relay user actions
- Hub publishes to Redis, Next.js SSE subscribes from Redis (Phase 5)
- Docker compose already has agent-hub container defined

</code_context>

<specifics>
## Specific Ideas

- The Hub should log all agent connections/disconnections with agent name and timestamp — useful for debugging
- Consider a simple admin endpoint (GET /status) that returns all agent connection states for the operator console (Phase 9)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-agent-connection-hub*
*Context gathered: 2026-04-21*
