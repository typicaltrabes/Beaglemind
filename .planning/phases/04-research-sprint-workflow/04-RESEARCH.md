# Phase 4: Research Sprint Workflow - Research

**Researched:** 2026-04-21
**Domain:** Full-stack real-time workflow UI (Next.js App Router + SSE + Zustand + Drizzle schema extension)
**Confidence:** HIGH

## Summary

Phase 4 builds the core product loop: projects, runs, plan approval, question queue, artifact download, and real-time event streaming. The technical surface is broad but well-bounded -- six new Drizzle tables in the tenant schema factory, SSE streaming from Redis pub/sub via Next.js Route Handlers, Zustand for real-time event state, TanStack Query for CRUD, and shadcn/ui card components for plan approval, questions, and artifacts.

The most complex technical area is the SSE endpoint in Next.js App Router. The correct pattern uses `ReadableStream` (not `TransformStream`) with `request.signal` for abort cleanup. The Hub already publishes all events to Redis channels with the format `run:{tenantId}:{runId}`, and the events table has sequence numbers for catch-up replay. The browser `EventSource` API handles reconnection natively, and `Last-Event-ID` enables gap-free catch-up.

The Hub needs two new HTTP routes (`/runs/approve` and `/runs/questions/answer`) to complete the command path from browser to agents. The existing `/send`, `/runs/start`, and `/runs/stop` cover the rest.

**Primary recommendation:** Build bottom-up: schema first, then API routes + Hub extensions, then SSE endpoint, then Zustand store, then UI components. Each layer is independently testable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Projects table: id (uuid), name, description, created_by (FK), created_at, updated_at
- **D-02:** Runs table: id, project_id (FK), kind (research_sprint | red_team_pass), parent_run_id (nullable), status (pending | planned | approved | executing | completed | cancelled), prompt, created_by (FK), created_at, updated_at
- **D-03:** Plans table: id, run_id (FK), content (jsonb), cost_estimate (jsonb {min, max, currency}), duration_estimate (text), approved_at, approved_by (FK)
- **D-04:** Questions table: id, run_id (FK), agent_id, content, answer (nullable), answered_at, answered_by (FK), created_at
- **D-05:** Artifacts table: id, run_id (FK), filename, mime_type, size_bytes, minio_key, agent_id, created_at
- **D-06:** State transitions table: id, run_id (FK), from_status, to_status, triggered_by, created_at
- **D-07:** Valid state transitions: pending->planned, planned->approved, planned->cancelled, approved->executing, executing->completed, executing->cancelled
- **D-08:** Starting a run: POST /api/runs creates run (pending), calls Hub POST /runs/start
- **D-09:** Approving: POST /api/runs/[id]/approve transitions approved->executing, calls Hub POST /runs/approve
- **D-10:** Stopping: POST /api/runs/[id]/stop transitions to cancelled, calls Hub POST /runs/stop
- **D-11:** Plan arrives as plan_proposal SSE event, rendered as card with cost, duration, approve/reject buttons
- **D-12:** Approve calls POST /api/runs/[id]/approve, reject calls /stop
- **D-13:** Questions arrive as question SSE events, rendered inline as cards with answer input
- **D-14:** Sidebar question queue with badge count, click scrolls to question
- **D-15:** POST /api/runs/[id]/questions/[qid]/answer submits answer, Hub forwards to agent
- **D-16:** GET /api/runs/[id]/stream -- SSE endpoint, subscribes to Redis channel run:{tenantId}:{runId}
- **D-17:** On connect, replay all events from DB, then switch to real-time Redis
- **D-18:** Browser uses EventSource, Zustand appends by sequence number
- **D-19:** Sidebar project list with "New project" button
- **D-20:** Active project shows runs, user can start new run
- **D-21:** Layout: sidebar (projects + questions) | main (transcript or project overview)
- **D-22:** Artifacts via SSE, Hub stores in MinIO bucket tenant_{id}/runs/{runId}/artifacts/{filename}
- **D-23:** Artifact card with filename, size, download button; download generates presigned URL
- **D-24:** Inline preview deferred to Phase 7
- **D-25:** Composer: text input at bottom, sends to Mo via Hub POST /send
- **D-26:** Stop button when run is executing

### Claude's Discretion
- Zustand store structure for runs/events
- TanStack Query configuration for project/run data fetching
- SSE reconnection strategy in the browser
- Exact card component styling (within dark theme + wireframe aesthetic)
- Error handling and loading states
- Run list sort order and filtering

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORK-01 | User can create a new project | D-01 projects table + POST /api/projects route + sidebar "New project" form |
| WORK-02 | User can start a research sprint by sending a prompt to Mo | D-08 run creation + Hub /runs/start + composer component |
| WORK-03 | Mo generates a plan with cost estimate; user sees plan-approval card | D-11 plan_proposal event type + plan approval card component |
| WORK-04 | Run does not proceed until user approves the plan | D-07 state machine (planned->approved->executing) + D-09 approve route |
| WORK-05 | Agents queue clarifying questions | D-04 questions table + D-13 question events + question card component |
| WORK-06 | User can answer queued questions inline | D-15 answer API + D-14 sidebar queue |
| WORK-07 | User can stop a running sprint | D-10 stop route + D-26 stop button component |
| WORK-08 | Run state machine tracks transitions | D-06 state_transitions table + D-07 valid transitions + server-side validation |
| WORK-09 | Completed run delivers downloadable artifacts | D-05 artifacts table + D-22/D-23 MinIO + presigned URL download |
</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| Next.js | 15.5.15 | App Router, API routes, SSE endpoints | [VERIFIED: package.json] |
| React | ^19.0.0 | UI components | [VERIFIED: package.json] |
| Drizzle ORM | 0.45.2 | Tenant schema extension (6 new tables) | [VERIFIED: package.json] |
| ioredis | ^5.10.1 | Redis pub/sub subscriber (for SSE endpoint) | [VERIFIED: agent-hub package.json] |
| @aws-sdk/client-s3 | 3.1033.0 | MinIO presigned URLs | [VERIFIED: packages/db package.json] |
| zod | 4.3.6 (zod/v4) | API input validation | [VERIFIED: package.json] |
| Tailwind CSS | 4.x | Styling (CSS-first, @theme variables defined) | [VERIFIED: globals.css] |

### New Dependencies to Install

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.12 | Client state for real-time events | [VERIFIED: npm registry] Lightweight, subscribeWithSelector for fine-grained re-renders on SSE events |
| @tanstack/react-query | 5.99.2 | Server state for project/run CRUD | [VERIFIED: npm registry] Cache invalidation, optimistic updates, suspense support |
| @aws-sdk/s3-request-presigner | 3.1033.0 | Presigned URL generation for artifact download | [VERIFIED: npm registry] Required alongside client-s3 for getSignedUrl() |
| ioredis | ^5.10.1 | Redis subscriber in Next.js SSE endpoint | [VERIFIED: npm registry] Already used in agent-hub, add to apps/web |

### shadcn/ui Components to Add

| Component | Purpose | Install Command |
|-----------|---------|-----------------|
| button | Approve, Reject, Download, Stop, New Project | `npx shadcn@latest add button` |
| card | Plan approval card, question card, artifact card | `npx shadcn@latest add card` |
| input | Question answer input, project name | `npx shadcn@latest add input` |
| textarea | Composer, project description | `npx shadcn@latest add textarea` |
| badge | Question count badge, run status | `npx shadcn@latest add badge` |
| dialog | New project modal | `npx shadcn@latest add dialog` |
| scroll-area | Sidebar scroll, transcript scroll | `npx shadcn@latest add scroll-area` |
| separator | Sidebar section dividers | `npx shadcn@latest add separator` |
| skeleton | Loading states | `npx shadcn@latest add skeleton` |
| tooltip | Icon button tooltips | `npx shadcn@latest add tooltip` |

**Note:** shadcn/ui is NOT initialized yet (no `components.json` found). First run: `npx shadcn@latest init` with dark theme, New York style, and the existing `@theme` CSS variables. [VERIFIED: no components.json in apps/web]

**Installation:**
```bash
# In apps/web
pnpm add zustand@^5.0.12 @tanstack/react-query@^5.99.2 ioredis@^5.10.1

# In packages/db (already has @aws-sdk/client-s3)
pnpm add @aws-sdk/s3-request-presigner@3.1033.0

# Initialize shadcn/ui (first time)
cd apps/web && npx shadcn@latest init

# Add components
npx shadcn@latest add button card input textarea badge dialog scroll-area separator skeleton tooltip
```

## Architecture Patterns

### Project Structure (new files in apps/web)
```
apps/web/
  app/
    (dashboard)/
      layout.tsx              # UPDATE: add sidebar + query provider
      page.tsx                # UPDATE: redirect to /projects or show project list
      projects/
        page.tsx              # Project list (server component)
        new/page.tsx          # OR use dialog in sidebar
        [projectId]/
          page.tsx            # Project overview with run list
          runs/
            [runId]/
              page.tsx        # Run transcript page (client-heavy)
    api/
      projects/
        route.ts              # GET (list) + POST (create)
      runs/
        route.ts              # POST (create run)
        [id]/
          stream/route.ts     # GET SSE endpoint
          approve/route.ts    # POST approve plan
          stop/route.ts       # POST stop run
          questions/
            [qid]/
              answer/route.ts # POST answer question
      artifacts/
        [id]/
          download/route.ts   # GET presigned URL redirect
  components/
    ui/                       # shadcn/ui components (auto-generated)
    sidebar/
      project-list.tsx        # Project list in sidebar
      question-queue.tsx      # Question queue with badge
    transcript/
      message-list.tsx        # Scrollable message list
      plan-card.tsx           # Plan approval card
      question-card.tsx       # Question card with answer input
      artifact-card.tsx       # Artifact card with download
      composer.tsx            # Text input + send/stop buttons
    providers/
      query-provider.tsx      # TanStack Query provider (client component)
      run-stream-provider.tsx # SSE connection manager
  lib/
    stores/
      run-store.ts            # Zustand: active run events
      ui-store.ts             # Zustand: sidebar state, active project
    hooks/
      use-sse.ts              # EventSource hook with reconnect
      use-run-actions.ts      # Mutation hooks (approve, stop, answer)
    api/
      hub-client.ts           # Internal HTTP calls to Hub
    state-machine.ts          # Run state transition validator
```

### Pattern 1: SSE Endpoint with Redis Subscriber + DB Catch-Up

**What:** Next.js route handler that replays events from DB, then streams real-time from Redis.
**When:** GET /api/runs/[id]/stream
**Critical:** Use `ReadableStream` with `start()` that does NOT await the async work. Return `Response` immediately. Use `request.signal` for cleanup.

```typescript
// Source: Next.js discussions + verified Redis pub/sub pattern
// apps/web/app/api/runs/[id]/stream/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { tenantId } = await requireTenantContext();
  const { id: runId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (eventId: string, data: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`id: ${eventId}\ndata: ${data}\n\n`));
      };

      // 1. Replay from DB (catch-up)
      const replay = async () => {
        const { db, schema } = getTenantDb(tenantId);
        const events = await db.select()
          .from(schema.events)
          .where(eq(schema.events.runId, runId))
          .orderBy(asc(schema.events.sequenceNumber));

        for (const event of events) {
          send(String(event.sequenceNumber), JSON.stringify(event));
        }

        // 2. Subscribe to Redis for real-time
        const subscriber = new Redis(process.env.REDIS_URL!);
        const channel = `run:${tenantId}:${runId}`;
        await subscriber.subscribe(channel);
        subscriber.on('message', (_ch, message) => {
          const parsed = JSON.parse(message);
          send(String(parsed.sequenceNumber), message);
        });

        // Heartbeat every 30s to keep connection alive
        const heartbeat = setInterval(() => {
          if (closed) return;
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, 30_000);

        // Cleanup on client disconnect
        request.signal.addEventListener('abort', () => {
          closed = true;
          clearInterval(heartbeat);
          subscriber.unsubscribe(channel).then(() => subscriber.quit());
          try { controller.close(); } catch {}
        });
      };

      // Do NOT await -- let Response return immediately
      replay().catch((err) => {
        console.error('SSE replay error:', err);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Prevents Caddy/nginx buffering
    },
  });
}
```

**Key pitfalls avoided:**
- `start()` must NOT await — or Next.js buffers the entire stream [VERIFIED: Next.js discussion #48427]
- `request.signal` abort listener is the ONLY reliable way to detect client disconnect in App Router [VERIFIED: Next.js discussion #61972]
- `X-Accel-Buffering: no` prevents Caddy from buffering SSE chunks [ASSUMED]
- Heartbeat prevents proxy timeout (Caddy default timeout is configurable) [ASSUMED]

### Pattern 2: Zustand Store for Real-Time Events (Claude's Discretion)

**What:** Normalized event store with Map for O(1) lookup, array for ordering, sequence-based deduplication.
**Recommendation:**

```typescript
// apps/web/lib/stores/run-store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { HubEventEnvelope } from '@beagle-console/shared';

interface RunState {
  runId: string | null;
  events: Map<number, HubEventEnvelope>; // keyed by sequenceNumber
  eventOrder: number[]; // sorted sequence numbers
  lastSequence: number; // for dedup on reconnect
  status: string; // current run status

  // Derived selectors
  plan: HubEventEnvelope | null;
  unansweredQuestions: HubEventEnvelope[];
  artifacts: HubEventEnvelope[];
}

interface RunActions {
  initRun: (runId: string) => void;
  appendEvent: (event: HubEventEnvelope) => void;
  appendEvents: (events: HubEventEnvelope[]) => void; // batch for replay
  reset: () => void;
}

export const useRunStore = create<RunState & RunActions>()(
  immer((set, get) => ({
    runId: null,
    events: new Map(),
    eventOrder: [],
    lastSequence: 0,
    status: 'pending',
    plan: null,
    unansweredQuestions: [],
    artifacts: [],

    initRun: (runId) => set((s) => {
      s.runId = runId;
      s.events = new Map();
      s.eventOrder = [];
      s.lastSequence = 0;
      s.status = 'pending';
    }),

    appendEvent: (event) => set((s) => {
      // Dedup: skip if already seen
      if (event.sequenceNumber <= s.lastSequence) return;
      s.events.set(event.sequenceNumber, event);
      s.eventOrder.push(event.sequenceNumber);
      s.lastSequence = event.sequenceNumber;

      // Update derived state
      if (event.type === 'state_transition') {
        s.status = (event.content as any).to;
      }
      if (event.type === 'plan_proposal') {
        s.plan = event;
      }
    }),

    appendEvents: (events) => set((s) => {
      for (const event of events) {
        if (event.sequenceNumber <= s.lastSequence) continue;
        s.events.set(event.sequenceNumber, event);
        s.eventOrder.push(event.sequenceNumber);
        s.lastSequence = event.sequenceNumber;
        if (event.type === 'state_transition') {
          s.status = (event.content as any).to;
        }
        if (event.type === 'plan_proposal') {
          s.plan = event;
        }
      }
    }),

    reset: () => set((s) => {
      s.runId = null;
      s.events = new Map();
      s.eventOrder = [];
      s.lastSequence = 0;
      s.status = 'pending';
      s.plan = null;
    }),
  }))
);
```

**Why this structure:**
- `Map<number, HubEventEnvelope>` gives O(1) lookup by sequence number
- `eventOrder: number[]` preserves insertion order for rendering
- `lastSequence` enables dedup on reconnect (catch-up may re-send events)
- Derived selectors (`plan`, `unansweredQuestions`, `artifacts`) computed inline on mutation for O(1) reads
- `immer` middleware for ergonomic nested updates

### Pattern 3: TanStack Query for CRUD + Zustand for Real-Time (Claude's Discretion)

**What:** Strict separation -- TanStack Query owns project/run REST data, Zustand owns streaming events.

```typescript
// apps/web/lib/hooks/use-projects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects').then(r => r.json()),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      fetch('/api/projects', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

// Runs for a project
export function useRuns(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'runs'],
    queryFn: () => fetch(`/api/projects/${projectId}/runs`).then(r => r.json()),
  });
}
```

**Key rule:** Never put SSE event data in TanStack Query cache. TanStack Query handles REST (projects list, run metadata). Zustand handles the real-time event stream. [CITED: dev.to/martinrojas federated-state-done-right]

### Pattern 4: EventSource Hook with Reconnection (Claude's Discretion)

```typescript
// apps/web/lib/hooks/use-sse.ts
import { useEffect, useRef } from 'react';
import { useRunStore } from '../stores/run-store';

export function useRunStream(runId: string | null) {
  const appendEvent = useRunStore((s) => s.appendEvent);
  const lastSequence = useRunStore((s) => s.lastSequence);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) return;

    const url = `/api/runs/${runId}/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      appendEvent(parsed);
    };

    es.onerror = () => {
      // EventSource auto-reconnects. On reconnect, server uses
      // Last-Event-ID header to replay only missed events.
      // No manual reconnect logic needed.
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [runId, appendEvent]);
}
```

**EventSource reconnect behavior:**
- Browser automatically reconnects with exponential backoff [CITED: MDN EventSource docs]
- Sends `Last-Event-ID` header on reconnect (we set `id:` on each SSE message = sequenceNumber)
- Server reads `Last-Event-ID` from request headers and replays only events after that sequence
- Combined with Zustand's `lastSequence` dedup, this is gap-free

### Pattern 5: Run State Machine (Server-Side)

```typescript
// apps/web/lib/state-machine.ts
type RunStatus = 'pending' | 'planned' | 'approved' | 'executing' | 'completed' | 'cancelled';

const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  pending: ['planned'],
  planned: ['approved', 'cancelled'],
  approved: ['executing'],
  executing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition: ${from} -> ${to}`);
  }
}
```

### Pattern 6: Presigned URL for Artifact Download

```typescript
// apps/web/app/api/artifacts/[id]/download/route.ts
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getMinioClient } from '@beagle-console/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { tenantId } = await requireTenantContext();
  const { id } = await params;

  // Look up artifact metadata
  const { db, schema } = getTenantDb(tenantId);
  const artifact = await db.select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.id, id))
    .limit(1);

  if (!artifact[0]) return new Response('Not found', { status: 404 });

  // Generate presigned URL (5 min expiry)
  const client = getMinioClient();
  const command = new GetObjectCommand({
    Bucket: `tenant-${tenantId}`,
    Key: artifact[0].minioKey,
  });
  const url = await getSignedUrl(client, command, { expiresIn: 300 });

  return Response.redirect(url);
}
```

**MinIO compatibility note:** The existing `getMinioClient()` in `packages/db/src/minio-client.ts` already uses `forcePathStyle: true` which is required for MinIO. The `@aws-sdk/s3-request-presigner` works with this client. [VERIFIED: minio-client.ts source]

### Anti-Patterns to Avoid

- **Polling for events:** Use SSE, never `setInterval` + `fetch`. The Redis pub/sub bridge exists for this. [VERIFIED: ARCHITECTURE.md anti-pattern #2]
- **Storing event stream in TanStack Query cache:** TanStack Query is for REST/CRUD. Event stream lives in Zustand only. Mixing them creates stale cache / invalidation nightmares. [CITED: dev.to/martinrojas]
- **Creating new Redis connections per SSE request without cleanup:** Each SSE endpoint creates a Redis subscriber. MUST unsubscribe + quit on abort. Leaked subscribers exhaust Redis connections. [ASSUMED]
- **Awaiting in ReadableStream.start():** This blocks the Response from being returned to the client. Next.js buffers the entire response. Async work must be fire-and-forget inside start(). [VERIFIED: Next.js discussion #48427]
- **Using `TransformStream` with writable/writer pattern:** While it works, `ReadableStream` with `controller.enqueue()` is simpler and avoids the WritableStream closed errors seen in Next.js issues. [VERIFIED: Next.js discussion #61972]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned URLs | Custom signed URL logic | `@aws-sdk/s3-request-presigner` + `getSignedUrl()` | Signature algorithms are complex, MinIO-compatible out of box |
| SSE parsing in browser | Custom fetch + stream reader | Native `EventSource` API | Auto-reconnect, `Last-Event-ID`, error handling built in |
| State machine transitions | Ad-hoc if/else | Lookup table with `VALID_TRANSITIONS` map | Exhaustive, testable, single source of truth |
| Form validation | Manual checks | Zod schemas shared between client/server | Type-safe, DRY, already used throughout codebase |
| Optimistic UI updates | Manual state rollback | TanStack Query `onMutate` / `onError` | Built-in cache rollback on failure |

## Common Pitfalls

### Pitfall 1: SSE Buffering by Proxy
**What goes wrong:** SSE events arrive in batches instead of real-time because Caddy/nginx buffers responses.
**Why it happens:** Reverse proxies buffer by default for performance.
**How to avoid:** Set `X-Accel-Buffering: no` header on SSE response. In Caddy, `flush_interval -1` in the reverse_proxy directive. [ASSUMED -- verify Caddy config]
**Warning signs:** Events arrive in bursts after long pauses.

### Pitfall 2: Redis Subscriber Leak
**What goes wrong:** Each SSE connection creates a Redis subscriber. If abort handler doesn't fire (e.g., server restart), subscribers accumulate.
**Why it happens:** `request.signal` abort event doesn't fire on process shutdown.
**How to avoid:** Track active subscribers in a Set. On graceful shutdown, unsubscribe all. Limit max concurrent SSE connections per tenant.
**Warning signs:** `redis-cli client list` shows growing subscriber count.

### Pitfall 3: Sequence Number Gap on Reconnect
**What goes wrong:** Client reconnects, server replays from DB, but a recently published event hasn't been committed to DB yet.
**Why it happens:** Race condition between event store persistence and Redis pub/sub delivery.
**How to avoid:** The Hub already persists BEFORE publishing (D-08 in event-store.ts). On SSE reconnect with `Last-Event-ID`, replay from DB where `sequenceNumber > lastEventId`, then subscribe to Redis. The persist-before-publish guarantee means no gaps.
**Warning signs:** Duplicate or missing events in transcript.

### Pitfall 4: Next.js App Router Params Promise
**What goes wrong:** `params.id` throws because params is a Promise in Next.js 15.
**Why it happens:** Next.js 15 changed route handler params to be async.
**How to avoid:** Always `const { id } = await params;` in route handlers and page components.
**Warning signs:** Type errors or runtime "params.then is not a function".

### Pitfall 5: shadcn/ui Not Initialized
**What goes wrong:** `npx shadcn add button` fails with "components.json not found".
**Why it happens:** shadcn/ui was listed as initialized in STACK.md but `components.json` doesn't exist.
**How to avoid:** Run `npx shadcn@latest init` before adding any components. Configure for: dark theme, New York style, CSS variables, `@/components/ui` alias.
**Warning signs:** Missing `components.json` file.

### Pitfall 6: Hub Missing /runs/approve and /runs/questions/answer Routes
**What goes wrong:** Browser sends approve/answer requests but Hub returns 404.
**Why it happens:** Phase 3 only implemented /send, /runs/start, /runs/stop. Approve and answer routes were not part of Phase 3 scope.
**How to avoid:** Add `handleRunApprove` and `handleQuestionAnswer` to Hub HTTP routes in this phase.
**Warning signs:** 404 responses from Hub on approve/answer API calls.

## Code Examples

### Drizzle Schema Extension (6 New Tables)

```typescript
// packages/db/src/schema/tenant.ts -- EXTEND existing factory
// Source: existing createTenantSchema pattern + D-01 through D-06

export function createTenantSchema(tenantId: string) {
  const schema = pgSchema(`tenant_${tenantId}`);

  // Existing tables
  const runs = schema.table('runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(), // FK to projects
    kind: text('kind').notNull().default('research_sprint'),
    parentRunId: uuid('parent_run_id'), // nullable, for red-team
    status: text('status').notNull().default('pending'),
    prompt: text('prompt'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // ... existing messages and events tables ...

  // NEW: Projects
  const projects = schema.table('projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // NEW: Plans
  const plans = schema.table('plans', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    content: jsonb('content').notNull(),
    costEstimate: jsonb('cost_estimate'), // { min, max, currency }
    durationEstimate: text('duration_estimate'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by'),
  });

  // NEW: Questions
  const questions = schema.table('questions', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    agentId: text('agent_id').notNull(),
    content: text('content').notNull(),
    answer: text('answer'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    answeredBy: uuid('answered_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // NEW: Artifacts
  const artifacts = schema.table('artifacts', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    minioKey: text('minio_key').notNull(),
    agentId: text('agent_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // NEW: State Transitions (audit log)
  const stateTransitions = schema.table('state_transitions', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    triggeredBy: text('triggered_by').notNull(), // 'user' or agent ID
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  return { schema, runs, messages, events, projects, plans, questions, artifacts, stateTransitions };
}
```

**Migration note:** The existing `runs` table has `title`, `status`, `prompt` columns but is MISSING `projectId`, `kind`, `parentRunId`, `createdBy`. The schema factory needs to be updated AND a migration run on existing tenant schemas. Also the `messages` table was Phase 3 scratch -- may need to be reconciled or dropped in favor of events-only. [VERIFIED: current tenant.ts source]

### Hub /runs/approve Route (New)

```typescript
// apps/agent-hub/src/http/routes.ts -- ADD

const RunApproveBody = z.object({
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

export async function handleRunApprove(
  body: unknown,
  registry: AgentRegistry,
  router: MessageRouter,
): Promise<{ ok: true }> {
  const parsed = RunApproveBody.parse(body);

  // Send approval signal to Mo
  const outbound: OpenClawOutbound = {
    type: 'chat.send',
    content: '[SYSTEM] Plan approved. Proceed with execution.',
    messageId: `msg_${randomUUID()}`,
    senderId: `console_${parsed.tenantId}`,
    senderName: 'Console Hub',
    chatType: 'direct',
    customData: { runId: parsed.runId, tenantId: parsed.tenantId },
  };
  registry.send('mo', outbound);

  // Persist state transition
  await router.persistAndPublish(parsed.tenantId, {
    type: 'state_transition',
    agentId: 'system',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: { from: 'planned', to: 'approved' },
    metadata: {},
  });

  // Immediately transition approved -> executing
  await router.persistAndPublish(parsed.tenantId, {
    type: 'state_transition',
    agentId: 'system',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: { from: 'approved', to: 'executing' },
    metadata: {},
  });

  return { ok: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel AI SDK `useChat` | Raw SSE + custom hooks | N/A for this project | AI SDK assumes direct LLM calls; we observe agents, not call models |
| `TransformStream` + writer for SSE | `ReadableStream` + controller | Next.js 15+ | Avoids WritableStream closed errors |
| `params.id` direct access | `await params` then destructure | Next.js 15 | Params are now async in route handlers |
| Zustand v4 curried create | Zustand v5 direct create | 2024 | Dropped deprecated APIs, cleaner middleware composition |
| TanStack Query v4 context sharing | TanStack Query v5 explicit QueryClient | 2024 | Must wrap app in QueryClientProvider |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Caddy needs `X-Accel-Buffering: no` or `flush_interval -1` for SSE | Pitfall 1 | SSE events arrive in batches -- fixable with Caddy config |
| A2 | Redis subscriber per SSE connection is acceptable at current scale (2-50 concurrent) | Pattern 1 | Redis connection exhaustion -- would need connection pooling |
| A3 | `immer` middleware works with Map in Zustand v5 | Pattern 2 | Would need to switch to plain object if Map serialization fails with immer |
| A4 | The existing `messages` table (Phase 3) should be kept alongside events or dropped | Schema | Migration complexity -- needs decision |

## Open Questions

1. **Messages table vs events table**
   - What we know: Phase 3 created both `messages` and `events` tables. Events has all Hub events with sequence numbers. Messages has a simpler structure.
   - What's unclear: Is the `messages` table still needed or should the transcript render entirely from `events`?
   - Recommendation: Use events-only for transcript rendering. The messages table may have been scaffolding. Keep but don't extend.

2. **Hub /runs/start state transition mismatch**
   - What we know: The existing `handleRunStart` publishes a `state_transition` from `pending` to `executing`. But D-07 says the flow is `pending -> planned -> approved -> executing`.
   - What's unclear: Was Phase 3's direct pending->executing intentional for testing, or a gap?
   - Recommendation: Update handleRunStart to transition `pending -> pending` (or not transition at all). Mo sends `plan_proposal` which triggers `pending -> planned`. Then approval triggers `planned -> approved -> executing`.

3. **Hub active run context: single run limitation**
   - What we know: Hub has a single `activeRunId` / `activeTenantId` variable. Only one run can be active at a time.
   - What's unclear: Does Phase 4 need concurrent runs? CONTEXT.md doesn't mention it.
   - Recommendation: Keep single-run for now. Multi-run support is a future concern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (listed in STACK.md, not yet installed) |
| Config file | None -- needs Wave 0 setup |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-01 | Create project via API | integration | `vitest run apps/web/app/api/projects/route.test.ts` | Wave 0 |
| WORK-02 | Start run via API, calls Hub | integration | `vitest run apps/web/app/api/runs/route.test.ts` | Wave 0 |
| WORK-03 | Plan proposal event renders card | unit | `vitest run apps/web/components/transcript/plan-card.test.tsx` | Wave 0 |
| WORK-04 | Approve transitions state correctly | unit | `vitest run apps/web/lib/state-machine.test.ts` | Wave 0 |
| WORK-05 | Question event renders card | unit | `vitest run apps/web/components/transcript/question-card.test.tsx` | Wave 0 |
| WORK-06 | Answer submission via API | integration | `vitest run apps/web/app/api/runs/[id]/questions/route.test.ts` | Wave 0 |
| WORK-07 | Stop run via API | integration | `vitest run apps/web/app/api/runs/[id]/stop/route.test.ts` | Wave 0 |
| WORK-08 | State machine validates all transitions | unit | `vitest run apps/web/lib/state-machine.test.ts` | Wave 0 |
| WORK-09 | Presigned URL generation for artifact | integration | `vitest run apps/web/app/api/artifacts/route.test.ts` | Wave 0 |

### Wave 0 Gaps
- [ ] Install vitest + @vitejs/plugin-react as devDeps in apps/web
- [ ] Create `vitest.config.ts` in apps/web
- [ ] `apps/web/lib/state-machine.test.ts` -- covers WORK-04, WORK-08
- [ ] Test infrastructure for API route testing (mock requireTenantContext)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | requireTenantContext() on every API route and SSE endpoint |
| V3 Session Management | Yes | Better Auth database sessions (already in place) |
| V4 Access Control | Yes | Tenant isolation: every query scoped via getTenantDb(tenantId) |
| V5 Input Validation | Yes | Zod schemas on all POST bodies; validate runId/projectId ownership |
| V6 Cryptography | No | No new crypto -- presigned URLs handled by AWS SDK |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data access via manipulated runId | Elevation of Privilege | Verify run belongs to tenant before any operation |
| SSE endpoint subscribing to another tenant's Redis channel | Information Disclosure | Channel name derived from authenticated tenantId, not request params |
| Presigned URL sharing beyond intended recipient | Information Disclosure | Short expiry (5 min), require auth before generating URL |
| State machine bypass (approve without plan) | Tampering | Server-side transition validation before DB update |

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/tenant.ts` -- existing schema structure [VERIFIED: codebase]
- `apps/agent-hub/src/http/routes.ts` -- existing Hub API routes [VERIFIED: codebase]
- `apps/agent-hub/src/events/event-store.ts` -- persist-before-publish pattern [VERIFIED: codebase]
- `apps/agent-hub/src/bridge/redis-publisher.ts` -- channel naming pattern `run:{tenantId}:{runId}` [VERIFIED: codebase]
- `packages/shared/src/hub-events.ts` -- HubEventEnvelope + MessageType [VERIFIED: codebase]
- npm registry -- zustand 5.0.12, @tanstack/react-query 5.99.2, @aws-sdk/s3-request-presigner 3.1033.0 [VERIFIED: npm view]

### Secondary (MEDIUM confidence)
- [Next.js SSE Discussion #48427](https://github.com/vercel/next.js/discussions/48427) -- ReadableStream pattern, don't await in start()
- [Next.js ResponseAborted Discussion #61972](https://github.com/vercel/next.js/discussions/61972) -- request.signal abort handling
- [MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) -- Last-Event-ID, auto-reconnect
- [Federated State: Zustand + TanStack Query](https://dev.to/martinrojas/federated-state-done-right-zustand-tanstack-query-and-the-patterns-that-actually-work-27c0) -- separation of concerns pattern
- [AWS SDK Presigned URLs blog](https://aws.amazon.com/blogs/developer/generate-presigned-url-modular-aws-sdk-javascript/) -- getSignedUrl pattern

### Tertiary (LOW confidence)
- Caddy SSE buffering behavior -- needs testing [ASSUMED]
- immer middleware with Map in Zustand v5 -- needs testing [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified in npm registry and existing codebase
- Architecture: HIGH -- SSE + Redis pub/sub pattern verified across multiple sources, existing Hub code confirms integration points
- Pitfalls: MEDIUM -- SSE-specific pitfalls verified via Next.js GitHub discussions; Caddy buffering and Redis connection limits assumed

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable stack, no fast-moving dependencies)
