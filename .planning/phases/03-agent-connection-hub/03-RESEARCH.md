# Phase 3: Agent Connection Hub - Research

**Researched:** 2026-04-21
**Domain:** WebSocket agent connectivity, event sourcing, Redis pub/sub
**Confidence:** HIGH

## Summary

The Agent Connection Hub is a Node.js service that maintains persistent WebSocket connections to OpenClaw agents (Mo, Sam, Herman) running on the Agents VPS, assigns monotonic sequence numbers to all messages, persists events to PostgreSQL, and publishes to Redis pub/sub for downstream consumption by Next.js SSE endpoints (Phase 5).

The critical discovery is that OpenClaw already has a community WebSocket channel plugin (`@taichi-labs/openclaw-websocket`) that provides a clean `chat.send` / `chat.response` / `chat.stream` / `chat.typing` / `chat.error` message protocol. Rather than building a custom OpenClaw channel plugin from scratch, the Hub should connect as a WebSocket client to this existing plugin installed on each agent. The plugin is installed per-agent via `openclaw plugins install @taichi-labs/openclaw-websocket` and configured in each agent's config to listen on a unique port. Authentication can be disabled for internal-only connections (the Hub is server-to-server on a private network).

**Primary recommendation:** Install `@taichi-labs/openclaw-websocket` plugin on each agent (Mo:18789, Sam:18790, Herman:19000), disable auth (internal network), and have the Hub connect as a standard WebSocket client using `ws@8.20.0`. Use `ioredis@5.10.1` with dedicated subscriber connections for pub/sub. Use Node's built-in `http` module for the internal HTTP API (3 routes -- not worth a framework). Persist events with Drizzle to an append-only `events` table in the tenant schema.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hub connects as a WebSocket client to each agent's OpenClaw instance on the Agents VPS (46.225.56.122): Mo on port 18789, Sam on port 18790, Herman on port 19000.
- **D-02:** Console channel plugin built for OpenClaw v2026.3.2 -- adds a "console" channel alongside existing WhatsApp channel. Plugin receives messages from Hub, sends agent responses back through the same WebSocket.
- **D-03:** Agent connection registry: `Map<agentId, WebSocket>` in the Hub process. Tracks connection state (connected/disconnecting/reconnecting).
- **D-04:** Reconnection with exponential backoff + jitter: base 1s, max 30s, jitter factor 0.5. Reconnects automatically on connection drop.
- **D-05:** Standard JSON message envelope with type, agentId, runId, tenantId, content, metadata, timestamp. Hub assigns sequenceNumber before persistence/broadcast.
- **D-06:** Message types: agent_message, plan_proposal, question, artifact, state_transition, system.
- **D-07:** Append-only events table: id (serial), run_id (uuid FK), sequence_number (integer), type (text), agent_id (text), content (jsonb), metadata (jsonb), created_at (timestamptz). Composite index on (run_id, sequence_number).
- **D-08:** Events persisted to PostgreSQL BEFORE broadcasting to Redis.
- **D-09:** Monotonic sequence numbers per-run, in-memory counter + database sequence fallback.
- **D-10:** Channel naming: `run:{tenantId}:{runId}`.
- **D-11:** Published message includes full event envelope + sequenceNumber.
- **D-12:** Hub publishes to Redis on beaglehq_backend network.
- **D-13:** Single Node process using `ws` library.
- **D-14:** Internal HTTP API: POST /send, POST /runs/start, POST /runs/stop. Docker-internal only.
- **D-15:** Health check at GET /health.
- **D-16:** Agent connection config from environment variables.

### Claude's Discretion
- Exact OpenClaw console channel plugin implementation details
- ws library configuration (ping/pong intervals, max payload size)
- Redis connection pooling configuration
- Internal HTTP API framework choice (plain http, express, fastify -- keep it minimal)
- Heartbeat interval for agent connections
- Logging library and format

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONN-01 | Agent Connection Hub connects to OpenClaw agents on Agents VPS via WebSocket | OpenClaw WebSocket plugin protocol documented, ws@8.20.0 verified, connection/handshake pattern established |
| CONN-02 | Console channel plugin built and deployed on Mo (OpenClaw integration) | @taichi-labs/openclaw-websocket plugin discovered -- can be installed directly. Config documented. |
| CONN-03 | Messages assigned monotonic sequence numbers at Hub before persistence/broadcast | In-memory counter pattern documented with DB sequence fallback |
| CONN-04 | WebSocket reconnection with exponential backoff + jitter | Reconnection pattern with exact parameters documented (base 1s, max 30s, jitter 0.5) |
| CONN-05 | Message persistence to event store (PostgreSQL) before broadcasting | Events table schema designed per D-07, Drizzle schema extension pattern documented |
| CONN-06 | Redis pub/sub bridge between Agent Hub and Next.js SSE endpoints | ioredis@5.10.1 pub/sub pattern with dedicated subscriber connections documented |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ws | 8.20.0 | WebSocket client to OpenClaw agents | Already in package.json. Lightest WS library, protocol-level ping/pong support. [VERIFIED: npm registry] |
| ioredis | 5.10.1 | Redis pub/sub + general commands | De facto Node Redis client. Built-in pub/sub mode, cluster support if needed later. [VERIFIED: npm registry] |
| @beagle-console/db | workspace:* | Drizzle ORM, tenant schema, connection pool | Already a workspace dependency. Extends with events table. [VERIFIED: package.json] |
| @beagle-console/shared | workspace:* | Zod schemas, shared types | Already a workspace dependency. Extend with message envelope schema. [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | 10.3.1 | Structured JSON logging | All Hub logging -- agent connections, message routing, errors. Structured JSON for production, pretty for dev. [VERIFIED: npm registry] |
| pino-pretty | latest | Dev log formatting | Dev-only pretty printing of pino logs. [ASSUMED] |
| zod (via zod/v4) | 4.3.6 | Message validation | Validate OpenClaw messages and internal envelope. Already used in shared package. [VERIFIED: codebase] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node http (internal API) | Fastify 5.8.5 | Fastify adds routing, validation, serialization -- overkill for 3 routes. Plain http keeps the dependency footprint minimal at 256MB container memory limit. |
| pino | console.log | No structured output, no log levels, no JSON format for log aggregation. Pino is ~50KB, worth it. |
| ioredis | redis (node-redis) | ioredis has better TypeScript support, built-in cluster mode, and more mature pub/sub API. node-redis v4 is fine but ioredis is the standard for production Node. |

**Installation:**
```bash
cd apps/agent-hub
pnpm add ioredis pino
pnpm add -D pino-pretty @types/node
```

**Version verification:**
- ws: 8.20.0 (already installed, verified in package.json) [VERIFIED: npm registry 2026-04-21]
- ioredis: 5.10.1 (latest stable) [VERIFIED: npm registry 2026-04-21]
- pino: 10.3.1 (latest stable) [VERIFIED: npm registry 2026-04-21]
- fastify: 5.8.5 (not using, but noted for reference) [VERIFIED: npm registry 2026-04-21]

## Architecture Patterns

### Recommended Project Structure
```
apps/agent-hub/src/
  index.ts                    # Entry point: boot HTTP server, init connections
  config.ts                   # Env var parsing with zod
  logger.ts                   # Pino logger factory
  connections/
    agent-registry.ts         # Map<agentId, ManagedConnection> + state tracking
    managed-connection.ts     # Single agent WS connection: connect, ping/pong, reconnect
    reconnect.ts              # Exponential backoff + jitter logic
  handlers/
    message-router.ts         # Dispatches OpenClaw messages to typed handlers
    chat-handler.ts           # chat.response / chat.stream -> agent_message events
    typing-handler.ts         # chat.typing -> system events
    error-handler.ts          # chat.error -> system events
  events/
    event-store.ts            # Insert events to tenant DB, assign sequence numbers
    sequence-counter.ts       # In-memory per-run counter + DB fallback
  bridge/
    redis-publisher.ts        # Publish events to run:{tenantId}:{runId}
    redis-client.ts           # Shared ioredis instances (one for commands, one for pub)
  http/
    server.ts                 # Node http server: /health, /send, /runs/start, /runs/stop
    routes.ts                 # Route handler functions
```

### Pattern 1: Managed Agent Connection

**What:** Each agent gets a `ManagedConnection` wrapper around `ws.WebSocket` that handles lifecycle (connect, ping/pong heartbeat, reconnect on drop, message dispatch).

**When to use:** Always -- every agent connection follows this pattern.

**Example:**
```typescript
// Source: ws@8 docs + OpenClaw WebSocket plugin protocol
import WebSocket from 'ws';

interface ManagedConnectionConfig {
  agentId: string;
  url: string;           // ws://46.225.56.122:18789/ws?senderId=console-hub
  pingIntervalMs: number; // 15000
  pongTimeoutMs: number;  // 10000
  onMessage: (agentId: string, data: unknown) => void;
  onStateChange: (agentId: string, state: ConnectionState) => void;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnecting' | 'reconnecting' | 'closed';

class ManagedConnection {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'closed';
  private pingTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;

  connect(): void {
    this.state = 'connecting';
    this.ws = new WebSocket(this.config.url);

    this.ws.on('open', () => {
      this.state = 'connected';
      this.startPingPong();
      this.config.onStateChange(this.config.agentId, this.state);
    });

    this.ws.on('message', (raw: Buffer) => {
      const msg = JSON.parse(raw.toString());
      this.config.onMessage(this.config.agentId, msg);
    });

    this.ws.on('pong', () => {
      if (this.pongTimer) clearTimeout(this.pongTimer);
    });

    this.ws.on('close', () => {
      this.stopPingPong();
      this.state = 'reconnecting';
      this.config.onStateChange(this.config.agentId, this.state);
      // Trigger reconnect via registry
    });

    this.ws.on('error', (err) => {
      // Log error, ws will emit 'close' after 'error'
    });
  }

  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startPingPong(): void {
    this.pingTimer = setInterval(() => {
      this.ws?.ping();
      this.pongTimer = setTimeout(() => {
        // No pong received -- terminate
        this.ws?.terminate();
      }, this.config.pongTimeoutMs);
    }, this.config.pingIntervalMs);
  }
}
```

### Pattern 2: OpenClaw WebSocket Plugin Message Protocol

**What:** The Hub sends `chat.send` messages to agents and receives `chat.typing`, `chat.stream`, `chat.response`, `chat.error` replies. These are mapped to the Hub's internal envelope format before persistence.

**When to use:** All agent communication.

**Example:**
```typescript
// Source: https://github.com/Taichi-Labs/openclaw-websocket README
// Sending a message to an agent
const outbound = {
  type: 'chat.send',
  content: 'User prompt text here',
  messageId: `msg_${nanoid()}`,
  senderId: `console_${tenantId}`,
  senderName: 'Console Hub',
  chatType: 'direct',
  customData: {
    runId: 'run-uuid',
    tenantId: 'tenant-uuid',
    originalMessageType: 'user_message',
  },
};
connection.send(outbound);

// Receiving agent responses -- map to internal envelope
function mapOpenClawToEnvelope(agentId: string, msg: OpenClawMessage, runId: string, tenantId: string): HubEvent {
  switch (msg.type) {
    case 'chat.response':
      return { type: 'agent_message', agentId, runId, tenantId, content: { text: msg.content }, metadata: { done: true } };
    case 'chat.stream':
      return { type: 'agent_message', agentId, runId, tenantId, content: { text: msg.content }, metadata: { done: msg.done, streaming: true } };
    case 'chat.typing':
      return { type: 'system', agentId, runId, tenantId, content: { event: 'typing' }, metadata: {} };
    case 'chat.error':
      return { type: 'system', agentId, runId, tenantId, content: { event: 'error', error: msg.error }, metadata: {} };
  }
}
```

### Pattern 3: Event Store with Sequence Numbering

**What:** Before any event is broadcast to Redis, it is assigned a monotonic sequence number and persisted to the tenant's `events` table. The sequence counter is per-run, in-memory, with a DB fallback for recovery.

**When to use:** Every event flowing through the Hub.

**Example:**
```typescript
// Source: D-07, D-08, D-09 from CONTEXT.md
class SequenceCounter {
  private counters = new Map<string, number>(); // runId -> last sequence

  async next(runId: string, db: DrizzleDb, events: EventsTable): Promise<number> {
    let current = this.counters.get(runId);
    if (current === undefined) {
      // Recover from DB on first access (restart recovery)
      const result = await db.select({ max: sql`COALESCE(MAX(sequence_number), 0)` })
        .from(events)
        .where(eq(events.runId, runId));
      current = Number(result[0].max);
    }
    const next = current + 1;
    this.counters.set(runId, next);
    return next;
  }

  reset(runId: string): void {
    this.counters.delete(runId);
  }
}
```

### Pattern 4: Redis Pub/Sub with Dedicated Connections

**What:** ioredis requires a dedicated connection for subscribing (subscriber mode locks the connection). The Hub uses two ioredis instances: one for publishing/commands, one reserved for future subscription needs. Phase 3 only publishes -- Phase 5 subscribes from Next.js.

**When to use:** Always -- this is the bridge architecture.

**Example:**
```typescript
// Source: ioredis docs on pub/sub
import Redis from 'ioredis';

// Publisher instance -- used for PUBLISH and general commands
const redisPub = new Redis(process.env.REDIS_URL);

// Subscriber instance -- NOT needed in Phase 3 (Hub only publishes)
// Phase 5 (Next.js SSE) will create subscriber instances
// const redisSub = new Redis(process.env.REDIS_URL);

async function publishEvent(tenantId: string, runId: string, event: HubEvent): Promise<void> {
  const channel = `run:${tenantId}:${runId}`;
  await redisPub.publish(channel, JSON.stringify(event));
}
```

### Anti-Patterns to Avoid
- **Single ioredis instance for pub and commands:** A subscribed connection cannot execute regular commands. Always use separate instances for pub vs sub.
- **Broadcasting before persisting:** D-08 is explicit: persist to Postgres first, then publish to Redis. If the insert fails, the event does not get broadcast. This ensures the event store is the source of truth.
- **Agent-specific message parsing:** Do not build separate parsers for each agent. The OpenClaw WebSocket plugin uses a uniform protocol. All three agents produce the same message format.
- **Reconnecting on `error` event:** The `ws` library emits `close` after `error`. Handle reconnection logic only on `close`, not on `error`. Handling both causes double-reconnect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenClaw channel integration | Custom ChannelPlugin from scratch | `@taichi-labs/openclaw-websocket` plugin | Already implements the full message protocol. Just install it on each agent and connect as a WS client. Building a channel plugin requires implementing the full ChannelPlugin interface (meta, setup, security, messaging, outbound, status). |
| Exponential backoff + jitter | Custom retry math | Simple utility function (30 lines) | The math is well-known but easy to get wrong. Use the exact formula from D-04. |
| JSON schema validation | Manual type checks | Zod schemas in @beagle-console/shared | Zod provides parse-or-throw with full TypeScript inference. Envelope and OpenClaw message schemas belong in the shared package. |
| Structured logging | console.log | pino | JSON output, log levels, child loggers for per-agent context. Essential for production debugging. |

**Key insight:** The biggest "don't hand-roll" here is the OpenClaw channel plugin. The `@taichi-labs/openclaw-websocket` plugin already does exactly what D-02 describes. Install it, configure it, connect to it. The Hub is a WebSocket client, not a plugin author.

## Common Pitfalls

### Pitfall 1: Double Reconnection on Error + Close
**What goes wrong:** The Hub triggers reconnection on both `error` and `close` events from ws, resulting in two concurrent connections to the same agent.
**Why it happens:** ws always emits `close` after `error`. If you attach reconnect logic to both, you get two attempts.
**How to avoid:** Only handle reconnection in the `close` event handler. The `error` handler should only log.
**Warning signs:** Two connections to the same agent in the registry. Duplicate messages in the event store.

### Pitfall 2: Sequence Number Gap on Hub Restart
**What goes wrong:** Hub restarts, in-memory sequence counter resets to 0, new events get sequence numbers that collide with existing events.
**Why it happens:** In-memory counter has no persistence across restarts.
**How to avoid:** On first access for any run, recover the counter from `MAX(sequence_number)` in the events table (Pattern 3). This is D-09's "database sequence as fallback."
**Warning signs:** Unique constraint violations on `(run_id, sequence_number)`.

### Pitfall 3: Unbounded Message Queue During Reconnection
**What goes wrong:** While an agent connection is down, the Hub buffers outgoing messages indefinitely. Agent comes back, gets flooded.
**Why it happens:** No cap on queued messages during reconnection.
**How to avoid:** Cap the outbound queue at 100 messages. Drop oldest messages if exceeded. Log when messages are dropped. For the console use case, user messages during agent downtime are unlikely (the UI should show the agent as offline).
**Warning signs:** Memory growth in Hub process during extended agent downtime.

### Pitfall 4: Redis Pub/Sub Message Loss
**What goes wrong:** Subscriber (Phase 5 Next.js) misses messages published while it was disconnected.
**Why it happens:** Redis pub/sub is fire-and-forget. No persistence. If no subscriber is listening, the message is gone.
**How to avoid:** This is why D-08 persists to PostgreSQL first. Subscribers that reconnect use sequence numbers to catch up by querying the event store for missed events. The pub/sub channel is for real-time push; the event store is the source of truth.
**Warning signs:** Gaps in transcript after SSE reconnection (detected by sequence number discontinuity).

### Pitfall 5: OpenClaw Plugin Not Installed or Wrong Port
**What goes wrong:** Hub connects to agent port but gets no WebSocket handshake because the openclaw-websocket plugin is not installed or configured on a different port.
**Why it happens:** Plugin installation and config is manual, done on the Agents VPS.
**How to avoid:** The Hub's health check should report per-agent connection status. On startup, log clearly whether each agent connection succeeded. Include the agent URL in error messages.
**Warning signs:** `ws` emits connection refused errors. Hub health check shows agents as disconnected.

### Pitfall 6: Docker Container Cannot Reach External VPS
**What goes wrong:** The agent-hub container on beaglehq_backend network cannot reach the Agents VPS at 46.225.56.122.
**Why it happens:** Docker bridge networks route to external IPs through the host by default, but firewall rules or DNS resolution issues can block it.
**How to avoid:** Docker containers on bridge networks can reach external IPs via the host's routing table. The Agents VPS is a public IP. Verify connectivity with a simple curl/telnet test in the container before wiring up WebSocket connections.
**Warning signs:** Connection timeout errors from ws, EHOSTUNREACH, or ECONNREFUSED.

## Code Examples

### Events Table Schema Extension (Drizzle)

```typescript
// Source: D-07, existing packages/db/src/schema/tenant.ts pattern
// Add to createTenantSchema in packages/db/src/schema/tenant.ts

const events = schema.table('events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  sequenceNumber: integer('sequence_number').notNull(),
  type: text('type').notNull(),       // agent_message | plan_proposal | question | artifact | state_transition | system
  agentId: text('agent_id').notNull(), // mo | sam | herman | jarvis | user | system
  content: jsonb('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('events_run_seq_idx').on(t.runId, t.sequenceNumber),
]);
```

### Message Envelope Zod Schema

```typescript
// Source: D-05, D-06 from CONTEXT.md
// Add to packages/shared/src/index.ts
import { z } from 'zod/v4';

export const MessageType = z.enum([
  'agent_message',
  'plan_proposal',
  'question',
  'artifact',
  'state_transition',
  'system',
]);

export const HubEventEnvelope = z.object({
  type: MessageType,
  agentId: z.string(),
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
  sequenceNumber: z.number().int().positive(),
  content: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export type HubEventEnvelope = z.infer<typeof HubEventEnvelope>;

// OpenClaw WebSocket plugin message types
export const OpenClawInbound = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat.typing') }),
  z.object({ type: z.literal('chat.stream'), messageId: z.string(), content: z.string(), done: z.boolean() }),
  z.object({ type: z.literal('chat.response'), messageId: z.string(), content: z.string(), done: z.literal(true) }),
  z.object({ type: z.literal('chat.error'), messageId: z.string().optional(), error: z.string() }),
]);

export type OpenClawInbound = z.infer<typeof OpenClawInbound>;
```

### Internal HTTP API (Plain Node http)

```typescript
// Source: D-14, D-15 from CONTEXT.md
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

function createHttpServer(hub: AgentHub) {
  return createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      const status = hub.getHealthStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      const agents = hub.getAgentStatuses();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(agents));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/send') {
      const body = await readJsonBody(req);
      await hub.sendUserMessage(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/runs/start') {
      const body = await readJsonBody(req);
      await hub.startRun(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/runs/stop') {
      const body = await readJsonBody(req);
      await hub.stopRun(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end();
  });
}
```

### Exponential Backoff + Jitter

```typescript
// Source: D-04 from CONTEXT.md
function calculateBackoff(attempt: number, base = 1000, max = 30000, jitter = 0.5): number {
  const exponential = Math.min(base * Math.pow(2, attempt), max);
  const jitterRange = exponential * jitter;
  const jittered = exponential + (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.floor(jittered));
}
// attempt 0: ~1000ms, attempt 1: ~2000ms, attempt 3: ~8000ms, caps at ~30000ms
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socket.IO for server-to-server | Raw ws for server-to-server | Always best practice | Socket.IO's overhead (protocol negotiation, rooms, namespaces) is unnecessary for server-to-server. ws is lighter and more predictable. |
| node-redis v3 | ioredis v5 | 2022+ | ioredis has better TypeScript support, pipeline batching, cluster-aware pub/sub. |
| Custom OpenClaw channel plugin | @taichi-labs/openclaw-websocket | 2025+ | Community plugin provides standard chat.send/response protocol. No need to implement ChannelPlugin interface. |

**Deprecated/outdated:**
- `redis` npm package v3: Use ioredis@5 or node-redis v4. v3 has no TypeScript support.
- ws v7: No significant issues, but v8 has performance improvements and ESM support.

## OpenClaw WebSocket Plugin Protocol

This section documents the exact protocol the Hub must implement as a WebSocket client.

### Connection

Connect to: `ws://{agentIp}:{agentPort}/ws?senderId=console-hub&senderName=Console`

No authentication needed for internal network connections (set `auth.enabled: false` in plugin config on each agent).

### Sending Messages to Agent

```json
{
  "type": "chat.send",
  "content": "User's message text",
  "messageId": "unique-id",
  "senderId": "console_{tenantId}",
  "senderName": "Console Hub",
  "chatType": "direct",
  "customData": {
    "runId": "uuid",
    "tenantId": "uuid"
  }
}
```

### Receiving Messages from Agent

| Type | Format | When |
|------|--------|------|
| `chat.typing` | `{ "type": "chat.typing" }` | Agent is processing |
| `chat.stream` | `{ "type": "chat.stream", "messageId": "...", "content": "partial...", "done": false }` | Streaming token-by-token |
| `chat.response` | `{ "type": "chat.response", "messageId": "...", "content": "full response", "done": true }` | Complete response |
| `chat.error` | `{ "type": "chat.error", "messageId": "...", "error": "message" }` | Error occurred |

[VERIFIED: https://github.com/Taichi-Labs/openclaw-websocket]

### Plugin Installation (on Agents VPS)

```bash
# SSH into Agents VPS (46.225.56.122)
# For each agent:
openclaw plugins install @taichi-labs/openclaw-websocket

# Configure in each agent's config.json:
{
  "channels": {
    "websocket": {
      "enabled": true,
      "port": 18789,    // Mo: 18789, Sam: 18790, Herman: 19000
      "host": "0.0.0.0",
      "path": "/ws",
      "auth": {
        "enabled": false  // Internal network only
      }
    }
  }
}
```

[VERIFIED: https://github.com/Taichi-Labs/openclaw-websocket]

## Discretion Recommendations

These are areas marked as Claude's discretion in CONTEXT.md. Research-backed recommendations:

### HTTP API Framework: Use Plain Node `http`
The Hub has exactly 5 routes (health, status, send, runs/start, runs/stop). Fastify 5.8.5 would add ~2MB to the bundle and a dependency chain. Plain `node:http` with a simple URL + method router is adequate. The Hub is not a general-purpose API server. [ASSUMED -- but verified that Fastify works; plain http is simpler]

### ws Configuration
- **Ping interval:** 15 seconds (aligns with OpenClaw's `tickIntervalMs` policy default) [VERIFIED: OpenClaw gateway protocol docs]
- **Pong timeout:** 10 seconds (standard practice) [VERIFIED: https://oneuptime.com/blog/post/2026-01-27-websocket-heartbeat/view]
- **Max payload size:** 25MB (`maxPayload: 26214400` -- matches OpenClaw's default) [VERIFIED: OpenClaw gateway protocol docs]

### Redis Configuration
- One ioredis instance for publishing and commands
- No subscriber needed in Phase 3 (subscribers live in Phase 5 / Next.js)
- `lazyConnect: true` for startup ordering
- `maxRetriesPerRequest: 3` for resilience
[ASSUMED -- standard ioredis configuration]

### Heartbeat Interval: 15 seconds
OpenClaw's gateway advertises `tickIntervalMs: 15000`. Aligning the Hub's ping interval to this value avoids premature disconnects. [VERIFIED: OpenClaw gateway protocol docs]

### Logging: pino with child loggers
- Root logger with `level: process.env.LOG_LEVEL || 'info'`
- Child loggers per agent: `logger.child({ agentId: 'mo' })`
- JSON output in production, pino-pretty in development
- Log: connection state changes, message received/sent counts, errors, sequence number assignments
[ASSUMED -- standard pino pattern]

## Existing Code Gaps

Analysis of what exists vs what needs to be built:

| Asset | Current State | Needed Change |
|-------|--------------|---------------|
| `apps/agent-hub/src/index.ts` | Bare HTTP server with /health only | Full Hub implementation |
| `apps/agent-hub/package.json` | Has ws, workspace deps | Add ioredis, pino |
| `packages/db/src/schema/tenant.ts` | Has runs + messages tables | Add events table per D-07 |
| `packages/shared/src/index.ts` | Has RunStatus, AgentName enums | Add HubEventEnvelope, MessageType, OpenClawInbound schemas; add 'sam', 'herman' to AgentName |
| `docker/docker-compose.yml` | Has agent-hub container | Add AGENT_MO_URL, AGENT_SAM_URL, AGENT_HERMAN_URL env vars |
| `packages/db/src/client.ts` | Shared pool, 25 connections | No change needed |
| OpenClaw agents (VPS) | WhatsApp channel only | Install @taichi-labs/openclaw-websocket plugin on each agent |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Plain Node http is sufficient for 5 internal routes | Discretion Recommendations | Low -- can switch to Fastify later without changing contract. Just a code organization preference. |
| A2 | pino-pretty is available as a dev formatting companion | Standard Stack | Very low -- if not, pino still logs JSON which is readable. |
| A3 | ioredis `lazyConnect: true` with `maxRetriesPerRequest: 3` is the right config | Discretion Recommendations | Low -- these are adjustable at runtime. |
| A4 | OpenClaw's `@taichi-labs/openclaw-websocket` plugin can be configured per-agent with different ports on the same host | OpenClaw Plugin Protocol | Medium -- if not, each agent needs a different host or path. Verify during deployment. |
| A5 | Docker containers on `beaglehq_backend` bridge network can reach external IP 46.225.56.122 | Pitfall 6 | Medium -- if blocked by firewall, need host networking or explicit routing. |
| A6 | The existing `messages` table can coexist with the new `events` table | Existing Code Gaps | Low -- they are in the same tenant schema but serve different purposes. Events is the raw event log; messages may become a view or be deprecated. |

## Open Questions

1. **OpenClaw per-agent plugin port configuration**
   - What we know: The `@taichi-labs/openclaw-websocket` plugin has a `port` config option. Each agent (Mo, Sam, Herman) runs as a separate OpenClaw process on the Agents VPS.
   - What's unclear: Whether each agent's config.json is independently configurable (likely yes -- each is a separate process with its own config directory).
   - Recommendation: Verify on Agents VPS that each agent has a separate config directory. If so, configure different ports per agent.

2. **Relationship between `messages` table and `events` table**
   - What we know: tenant.ts already has a `messages` table (id, runId, agentName, content, sequence, metadata). D-07 defines a new `events` table with slightly different columns.
   - What's unclear: Should messages be deprecated in favor of events? Or do they serve different purposes?
   - Recommendation: Events is the raw event log (all types including system). Messages is a consumer-facing projection (chat messages only). Build events now; decide on messages deprecation later. They can coexist.

3. **Agent senderId isolation per tenant**
   - What we know: OpenClaw WebSocket plugin sessions are isolated by `senderId`. The Hub sends `senderId: console_{tenantId}`.
   - What's unclear: If two tenants talk to Mo simultaneously, does OpenClaw maintain separate conversation contexts per senderId?
   - Recommendation: The plugin documentation says "Each distinct senderId maintains isolated conversation history." This should work. Verify with a test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Event persistence | (on BeagleHQ VPS) | 17.4 | -- |
| Redis | Pub/sub bridge | (on BeagleHQ VPS) | 7.x | -- |
| OpenClaw agents | WebSocket connections | (on Agents VPS 46.225.56.122) | v2026.3.2 | -- |
| Node.js | Runtime | (Docker image node:22-slim) | 22.x | -- |
| @taichi-labs/openclaw-websocket | Agent channel plugin | (needs installation on Agents VPS) | latest | Build custom channel plugin (high effort) |

**Missing dependencies with no fallback:**
- None -- all infrastructure exists.

**Missing dependencies with fallback:**
- `@taichi-labs/openclaw-websocket` needs to be installed on the Agents VPS. If it doesn't work as expected, fallback is building a minimal custom channel plugin (much higher effort).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (config at `vitest.config.ts` in repo root) |
| Config file | `/Users/lucastraber/Projects/beagle-console/vitest.config.ts` |
| Quick run command | `pnpm vitest run apps/agent-hub` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-01 | Hub connects to agents via WebSocket | integration | `pnpm vitest run apps/agent-hub/src/__tests__/connections.test.ts -x` | Wave 0 |
| CONN-02 | OpenClaw WebSocket plugin installed + configured | manual-only (VPS deployment) | N/A -- verify via Hub health check | N/A |
| CONN-03 | Sequence numbers assigned before persist/broadcast | unit | `pnpm vitest run apps/agent-hub/src/__tests__/sequence-counter.test.ts -x` | Wave 0 |
| CONN-04 | Reconnection with backoff + jitter | unit | `pnpm vitest run apps/agent-hub/src/__tests__/reconnect.test.ts -x` | Wave 0 |
| CONN-05 | Events persisted to PostgreSQL | integration | `pnpm vitest run apps/agent-hub/src/__tests__/event-store.test.ts -x` | Wave 0 |
| CONN-06 | Redis pub/sub publishes events | integration | `pnpm vitest run apps/agent-hub/src/__tests__/redis-publisher.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run apps/agent-hub`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/agent-hub/src/__tests__/connections.test.ts` -- covers CONN-01 (mock ws server)
- [ ] `apps/agent-hub/src/__tests__/sequence-counter.test.ts` -- covers CONN-03
- [ ] `apps/agent-hub/src/__tests__/reconnect.test.ts` -- covers CONN-04 (backoff math)
- [ ] `apps/agent-hub/src/__tests__/event-store.test.ts` -- covers CONN-05 (requires DB)
- [ ] `apps/agent-hub/src/__tests__/redis-publisher.test.ts` -- covers CONN-06 (mock ioredis)
- [ ] `apps/agent-hub/src/__tests__/message-router.test.ts` -- covers OpenClaw to envelope mapping

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (internal service) | N/A -- Hub is not user-facing. Auth is handled by Next.js. |
| V3 Session Management | No | N/A |
| V4 Access Control | Partial | Hub HTTP API is Docker-internal only. Not exposed via Caddy. |
| V5 Input Validation | Yes | Zod schemas validate all inbound OpenClaw messages and HTTP API payloads |
| V6 Cryptography | No | No secrets handled by Hub directly |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed WebSocket messages from agent | Tampering | Zod validation on all inbound messages. Drop and log invalid frames. |
| Internal HTTP API exposed externally | Elevation of Privilege | Docker network isolation -- Hub only on beaglehq_backend, not beaglehq_frontend. Caddy does not proxy to port 3001. |
| Redis pub/sub message injection | Tampering | Redis is on internal Docker network. No external access. Pub/sub channels use tenantId+runId namespacing. |
| Agent VPS WebSocket port exposed | Information Disclosure | OpenClaw WebSocket plugin binds to 0.0.0.0 but Agents VPS firewall should restrict ports 18789/18790/19000 to BeagleHQ VPS IP only. |

## Sources

### Primary (HIGH confidence)
- [@taichi-labs/openclaw-websocket GitHub](https://github.com/Taichi-Labs/openclaw-websocket) -- Plugin protocol, config, message format
- [OpenClaw Gateway Protocol docs](https://docs.openclaw.ai/gateway/protocol) -- Protocol spec, handshake, auth, tick interval
- [npm registry: ws@8.20.0](https://www.npmjs.com/package/ws) -- Latest version verified
- [npm registry: ioredis@5.10.1](https://www.npmjs.com/package/ioredis) -- Latest version verified
- [npm registry: pino@10.3.1](https://www.npmjs.com/package/pino) -- Latest version verified
- Existing codebase: `apps/agent-hub/`, `packages/db/`, `packages/shared/`, `docker/docker-compose.yml`

### Secondary (MEDIUM confidence)
- [OpenClaw Channel Architecture (DeepWiki)](https://deepwiki.com/openclaw/openclaw/4.1-channel-architecture) -- How channel plugins integrate
- [WebSocket Reconnection Logic](https://oneuptime.com/blog/post/2026-01-27-websocket-reconnection/view) -- Backoff + jitter patterns
- [WebSocket Heartbeat Best Practices](https://oneuptime.com/blog/post/2026-01-27-websocket-heartbeat/view) -- Ping/pong intervals

### Tertiary (LOW confidence)
- None -- all claims verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, all libraries are established
- Architecture: HIGH -- patterns match existing codebase conventions, OpenClaw protocol documented
- Pitfalls: HIGH -- based on ws/ioredis documented behavior and prior research in PITFALLS.md
- OpenClaw integration: MEDIUM -- plugin protocol verified but actual per-agent installation untested

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable domain, 30-day window)
