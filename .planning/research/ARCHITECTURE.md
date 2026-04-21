# Architecture Patterns

**Domain:** Multi-agent AI console / observable reasoning system
**Researched:** 2026-04-21

## Recommended Architecture

### High-Level System Diagram

```
                                    BeagleHQ VPS (46.224.167.166)
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                                                                             │
 │  ┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
 │  │  Caddy   │───>│ console-web  │───>│   Redis 7    │<───│ console-worker│  │
 │  │ (proxy)  │    │ (Next.js)    │    │ (pub/sub +   │    │ (BullMQ)      │  │
 │  └─────────┘    │ port 3000    │    │  job store)  │    └───────────────┘  │
 │       │         └──────┬───────┘    └──────┬───────┘                       │
 │       │                │                   │                               │
 │       │         ┌──────┴───────┐    ┌──────┴───────┐    ┌───────────────┐  │
 │       │         │  PostgreSQL  │    │ agent-hub    │    │    MinIO       │  │
 │       │         │  17.4        │    │ (Node WS)    │    │ (S3 storage)  │  │
 │       │         │ shared +     │    │ port 3001    │    │ port 9000     │  │
 │       │         │ tenant_*     │    └──────┬───────┘    └───────────────┘  │
 │       │         └──────────────┘           │                               │
 │       │                              ┌─────┴─────┐                         │
 │       │         Existing:            │WebSocket   │                         │
 │       │         Grafana, LiteLLM,    │connections │                         │
 │       │         Prometheus           └─────┬─────┘                         │
 └───────┼────────────────────────────────────┼───────────────────────────────┘
         │                                    │
    HTTPS│                              WS    │
         │                                    │
   ┌─────┴─────┐                    ┌─────────┴─────────┐
   │  Browser   │                    │  Agents VPS       │
   │  (SSE)     │                    │  46.225.56.122    │
   └───────────┘                    │  Mo, Sam, Herman  │
                                    │  (OpenClaw)       │
                                    └───────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Runtime |
|-----------|---------------|-------------------|---------|
| console-web | Next.js app: UI, API routes, SSE endpoints, auth | PostgreSQL, Redis, MinIO | Docker container |
| agent-hub | WebSocket server: agent connections, message routing, lifecycle | Redis (pub/sub), PostgreSQL (message persistence), Agents VPS | Docker container |
| console-worker | BullMQ processor: artifact processing, notifications, scheduled jobs | Redis (job queue), PostgreSQL, MinIO | Docker container |
| PostgreSQL | Data persistence: shared schema (auth, tenants) + per-tenant schemas (runs, messages) | Accessed by all services | Host process (existing) |
| Redis | Pub/sub bridge, BullMQ backend, session cache | Accessed by all services | Host process (existing) |
| MinIO | File/artifact storage with bucket-per-tenant isolation | console-web (presigned URLs), console-worker (processing) | Docker container |
| Caddy | TLS termination, reverse proxy, HTTPS | console-web, agent-hub (WebSocket upgrade) | Host process (existing) |

### Data Flow

**Research Sprint Lifecycle:**

```
1. User submits prompt via browser
   Browser --POST--> Next.js API --INSERT--> PostgreSQL (new run)
                                 --PUBLISH--> Redis ("new-run" channel)

2. Agent Hub picks up run
   Redis --SUBSCRIBE--> Agent Hub --WebSocket--> Mo (OpenClaw)

3. Mo creates plan, streams back
   Mo --WebSocket--> Agent Hub --PUBLISH--> Redis ("run:{id}:messages")
                               --INSERT--> PostgreSQL (messages)

4. Next.js streams to browser
   Redis --SUBSCRIBE--> Next.js SSE endpoint --SSE--> Browser
   Browser --Zustand store update--> React re-render

5. User approves plan
   Browser --POST--> Next.js API --UPDATE--> PostgreSQL (run status)
                                 --PUBLISH--> Redis ("run:{id}:approved")
   Redis --SUBSCRIBE--> Agent Hub --WebSocket--> Mo

6. Agents execute, stream results
   (repeat steps 3-4 for each agent message)

7. Artifacts delivered
   Agent --WebSocket--> Agent Hub --ENQUEUE--> BullMQ ("artifacts" queue)
   Worker --PROCESS--> MinIO (store file) + PostgreSQL (metadata)

8. Run completes
   Agent Hub --UPDATE--> PostgreSQL (run.status = "completed")
             --PUBLISH--> Redis ("run:{id}:complete")
```

## Patterns to Follow

### Pattern 1: Tenant-Scoped Middleware

**What:** Every request resolves tenant context before hitting business logic.
**When:** Every API route, every SSE connection, every database query.

```typescript
// middleware.ts - runs on every request
export async function middleware(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session) return redirect('/login');

  const tenantId = session.activeOrganizationId;
  if (!tenantId) return redirect('/select-org');

  // Inject tenant context into request headers for downstream use
  const headers = new Headers(request.headers);
  headers.set('x-tenant-id', tenantId);
  return NextResponse.next({ request: { headers } });
}
```

```typescript
// lib/db.ts - tenant-scoped database access
export function getTenantDb(tenantId: string) {
  const schema = createTenantSchema(tenantId);
  return drizzle(pool, { schema });
}

// Usage in API route
export async function GET(request: Request) {
  const tenantId = request.headers.get('x-tenant-id')!;
  const db = getTenantDb(tenantId);
  const runs = await db.select().from(db.schema.runs);
  return Response.json(runs);
}
```

### Pattern 2: SSE with Redis Pub/Sub Bridge

**What:** Agent Hub publishes messages to Redis. Next.js SSE endpoints subscribe and stream to browser.
**When:** Any real-time data flowing from agents to browser.

```typescript
// app/api/runs/[id]/stream/route.ts
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const tenantId = request.headers.get('x-tenant-id')!;
  const runId = params.id;
  const channel = `tenant:${tenantId}:run:${runId}:messages`;

  const stream = new ReadableStream({
    start(controller) {
      const subscriber = redis.duplicate();
      subscriber.subscribe(channel);

      subscriber.on('message', (ch, message) => {
        controller.enqueue(`data: ${message}\n\n`);
      });

      request.signal.addEventListener('abort', () => {
        subscriber.unsubscribe(channel);
        subscriber.quit();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Pattern 3: Normalized Message Store (Zustand)

**What:** Messages stored as Map for O(1) lookup, array of IDs for ordering. Prevents re-renders of entire list on new message.
**When:** Transcript UI with high-frequency updates.

```typescript
interface RunStore {
  messages: Map<string, Message>;
  messageOrder: string[];
  agentStatus: Map<string, AgentStatus>;

  appendMessage: (msg: Message) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
}

const useRunStore = create<RunStore>()(
  immer((set) => ({
    messages: new Map(),
    messageOrder: [],
    agentStatus: new Map(),

    appendMessage: (msg) => set((state) => {
      state.messages.set(msg.id, msg);
      state.messageOrder.push(msg.id);
    }),

    updateMessage: (id, patch) => set((state) => {
      const existing = state.messages.get(id);
      if (existing) state.messages.set(id, { ...existing, ...patch });
    }),
  }))
);
```

### Pattern 4: Clean/Studio Mode as UI Filter

**What:** Single data model, two rendering modes. Clean mode hides sentinel, process, and debug data. Studio mode shows everything.
**When:** All transcript and run UI components.

```typescript
// NOT two separate component trees. ONE tree with mode-aware rendering.
const mode = usePreferencesStore((s) => s.mode); // 'clean' | 'studio'

function MessageBubble({ message }: { message: Message }) {
  return (
    <div>
      <MessageContent content={message.content} />
      {mode === 'studio' && <MessageMeta tokens={message.tokens} model={message.model} />}
      {mode === 'studio' && message.sentinel && <SentinelBadge data={message.sentinel} />}
    </div>
  );
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared Database Connection Per Tenant

**What:** Creating a new Postgres connection pool per tenant on every request.
**Why bad:** Connection exhaustion. With 10 tenants and 20 connections each, you hit Postgres max_connections fast on 8GB RAM VPS.
**Instead:** Single connection pool, schema switching via `SET search_path` or Drizzle's pgSchema scoping. Pool size: 20-30 connections shared across all tenants.

### Anti-Pattern 2: Polling for Real-Time Updates

**What:** `setInterval` + `fetch` to check for new messages.
**Why bad:** Wastes bandwidth, adds latency, doesn't scale. 100ms polling on 10 runs = 100 req/sec.
**Instead:** SSE with Redis pub/sub. Zero-latency push, browser-native reconnect.

### Anti-Pattern 3: JWT-Only Sessions

**What:** Stateless JWT tokens for auth sessions.
**Why bad:** Cannot revoke sessions for break-glass. Cannot enforce single-session. MFA changes don't invalidate existing tokens.
**Instead:** Database sessions via Better Auth. Session table in shared schema. Revoke by deleting row.

### Anti-Pattern 4: Monolith WebSocket

**What:** Running WebSocket connections to both agents AND browsers from a single Node process.
**Why bad:** Agent connections are long-lived and bursty. Browser connections are many and short-lived. Different failure modes, different scaling needs.
**Instead:** Agent Hub handles agent WebSocket connections only. Browser gets SSE from Next.js. Redis pub/sub bridges them.

### Anti-Pattern 5: Storing Files in PostgreSQL

**What:** Using bytea columns for artifact storage.
**Why bad:** Bloats database, kills backup/restore speed, no presigned URL capability.
**Instead:** MinIO for files, PostgreSQL for metadata only.

## Monorepo Structure

```
beagle-console/
  apps/
    web/                  # Next.js app (console-web container)
      app/                # App Router pages and API routes
      components/         # React components
      lib/                # Shared utilities, db, auth config
    agent-hub/            # Node WebSocket service (console-agent-hub container)
      src/
        connections/      # WebSocket connection management
        handlers/         # Message type handlers
        bridge/           # Redis pub/sub bridge
    worker/               # BullMQ processors (console-worker container)
      src/
        queues/           # Queue definitions
        processors/       # Job handlers
  packages/
    db/                   # Drizzle schema, migrations, tenant utilities
    shared/               # Types, constants, validation schemas (zod)
  docker-compose.yml
  Caddyfile
```

**Why monorepo:** Three services share types (Message, Run, Agent), DB schema, and validation. Separate repos would mean duplicated types and version drift. Use npm workspaces (not Turborepo -- overkill for 3 apps).

## Scalability Considerations

| Concern | At 2 users (Product Proof) | At 50 users (Company Proof) | At 500+ users (Scale) |
|---------|----------------------------|-----------------------------|-----------------------|
| Database | Single Postgres, 20 conn pool | Same, monitor connection usage | Read replicas, pgBouncer |
| Real-time | Single SSE per run, trivial | ~50 concurrent SSE streams | Horizontal Next.js replicas behind Caddy |
| Agent Hub | 4-6 agent connections | Same agents, more runs queued | Queue-based dispatch, agent pool scaling |
| Storage | MinIO single node, fine | Same, monitor disk | MinIO distributed mode |
| Redis | Single instance, fine | Same, monitor memory | Redis Sentinel or Dragonfly |
| VPS | 8GB RAM, ~5GB available | Tight but workable | Second VPS or upgrade to 16GB |

**Key insight:** The architecture is designed for the Product Proof / Company Proof scale (2-50 users). It does NOT try to be horizontally scalable from day one. The boundaries (separate services, Redis pub/sub bridge, S3 API for storage) make it possible to scale later without rewrites, but premature scaling optimization would slow the two-person team.

## Sources

- [Docker Compose for Next.js + Postgres + Redis](https://dev.to/whoffagents/docker-compose-for-full-stack-development-nextjs-postgres-redis-and-production-builds-57m8) - MEDIUM confidence
- [Next.js SSE streaming](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events) - HIGH confidence
- [Drizzle pgSchema multi-tenancy](https://medium.com/@vimulatus/schema-based-multi-tenancy-with-drizzle-orm-6562483c9b03) - MEDIUM confidence
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) - HIGH confidence
- [BullMQ flows and job dependencies](https://docs.bullmq.io/) - HIGH confidence
- [MinIO presigned URLs](https://www.alexefimenko.com/posts/file-storage-nextjs-postgres-s3) - MEDIUM confidence
