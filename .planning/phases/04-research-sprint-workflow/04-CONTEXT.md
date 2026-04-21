# Phase 4: Research Sprint Workflow - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete research sprint workflow end-to-end: user creates a project, starts a sprint by prompting Mo, Mo returns a plan with cost estimate for approval, agents execute with clarifying questions queued for the user, and completed runs deliver downloadable artifacts. This is the core product loop — the reason the console exists.

This phase builds the Next.js frontend (pages, components, API routes) and the backend domain model (projects, runs, plans, questions, artifacts, state transitions). It connects to the Hub's HTTP API (Phase 3) for agent communication and uses SSE for real-time streaming from Redis pub/sub.

This phase does NOT build scene organization, TLDR banners, or Clean/Studio modes — those are Phases 5-6. The transcript here is a basic real-time message list.

</domain>

<decisions>
## Implementation Decisions

### Domain Model (Database)
- **D-01:** Projects table in tenant schema: id (uuid), name (text), description (text), created_by (FK users), created_at, updated_at.
- **D-02:** Runs table in tenant schema: id (uuid), project_id (FK), kind (research_sprint | red_team_pass), parent_run_id (nullable FK, for red-team), status (pending | planned | approved | executing | completed | cancelled), prompt (text), created_by (FK users), created_at, updated_at.
- **D-03:** Plans table: id, run_id (FK), content (jsonb — Mo's plan structure), cost_estimate (jsonb — { min, max, currency }), duration_estimate (text), approved_at (nullable), approved_by (nullable FK users).
- **D-04:** Questions table: id, run_id (FK), agent_id (text), content (text), answer (nullable text), answered_at (nullable), answered_by (nullable FK users), created_at.
- **D-05:** Artifacts table: id, run_id (FK), filename (text), mime_type (text), size_bytes (integer), minio_key (text), agent_id (text), created_at.
- **D-06:** State transitions table: id, run_id (FK), from_status (text), to_status (text), triggered_by (text — user or agent), created_at.

### Run Lifecycle
- **D-07:** State machine validates transitions server-side. Valid transitions:
  - pending → planned (Mo submits plan)
  - planned → approved (user approves)
  - planned → cancelled (user rejects)
  - approved → executing (system, after approval)
  - executing → completed (Mo signals done)
  - executing → cancelled (user stops)
- **D-08:** Starting a run: POST /api/runs creates run in DB (status: pending), calls Hub HTTP API POST /runs/start with { runId, tenantId, prompt, agentId: "mo" }.
- **D-09:** Approving a plan: POST /api/runs/[id]/approve transitions to approved → executing. Calls Hub POST /runs/approve to tell Mo to proceed.
- **D-10:** Stopping a run: POST /api/runs/[id]/stop transitions to cancelled. Calls Hub POST /runs/stop to signal agents.

### Plan Approval UX
- **D-11:** Plan arrives as a `plan_proposal` event via SSE. Rendered as a card in the transcript with: plan description, cost estimate (e.g. "$3-5"), duration estimate (e.g. "~45 min"), specialist agents, Approve and Reject buttons.
- **D-12:** Approve button calls POST /api/runs/[id]/approve. Reject calls POST /api/runs/[id]/stop. Both update the card state (disabled buttons, timestamp).

### Question Queue
- **D-13:** Questions arrive as `question` events via SSE. Rendered inline in the transcript as a card with the question text and an answer input field.
- **D-14:** Sidebar shows question queue with badge count of unanswered questions. Clicking a question scrolls to it in the transcript.
- **D-15:** POST /api/runs/[id]/questions/[qid]/answer submits the answer. Hub forwards to the asking agent.

### SSE Streaming
- **D-16:** Next.js API route GET /api/runs/[id]/stream — SSE endpoint. Subscribes to Redis pub/sub channel run:{tenantId}:{runId}. Streams events to the browser as they arrive.
- **D-17:** On initial connect, SSE endpoint replays all events for the run from the events table (catch-up). After replay, switches to real-time from Redis.
- **D-18:** Browser uses EventSource API. Zustand store appends events by sequence number for correct ordering.

### Project Management
- **D-19:** Sidebar shows project list (from tenant schema). "New project" button opens a simple form (name + description).
- **D-20:** Active project shows its runs. User can start a new run from the project page.
- **D-21:** Project page layout: sidebar (project list + question queue) | main area (run transcript or project overview).

### Artifact Delivery
- **D-22:** Artifacts arrive as `artifact` events via SSE. Hub stores the file in MinIO (bucket: tenant_{id}, key: runs/{runId}/artifacts/{filename}).
- **D-23:** Artifact card in transcript shows filename, size, and a download button. Download hits GET /api/artifacts/[id]/download which generates a MinIO presigned URL.
- **D-24:** Inline preview for docx/pdf deferred to Phase 7. Phase 4 delivers download only.

### Composer
- **D-25:** Simple text input at the bottom of the transcript. Send button posts user message. During an active run, messages go to Mo via Hub POST /send.
- **D-26:** Stop button appears when run is in executing state. Single red button, Clean-mode style from wireframes.

### Claude's Discretion
- Zustand store structure for runs/events
- TanStack Query configuration for project/run data fetching
- SSE reconnection strategy in the browser
- Exact card component styling (within dark theme + wireframe aesthetic)
- Error handling and loading states
- Run list sort order and filtering

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Document
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260417 Beagle Agent Console — Design Doc v3.md` — §6 research sprint workflow, §7 core UX, §8 domain model

### Wireframes
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260415 Frontend Wireframes.html` — Clean mode transcript layout, plan approval card, question card, artifact card, composer, sidebar

### Research
- `.planning/research/ARCHITECTURE.md` — Message flow, event sourcing pattern
- `.planning/research/FEATURES.md` — Governance features (plan approval, question queue)
- `.planning/research/STACK.md` — Zustand, TanStack Query, SSE patterns

### Existing Code
- `apps/agent-hub/src/http/routes.ts` — Hub HTTP API (/send, /runs/start, /runs/stop)
- `apps/agent-hub/src/events/event-store.ts` — Event persistence
- `apps/agent-hub/src/bridge/redis-publisher.ts` — Redis pub/sub publisher
- `packages/shared/src/hub-events.ts` — Message envelope types
- `packages/db/src/schema/tenant.ts` — Tenant schema (extend with projects, runs, plans, questions, artifacts tables)
- `apps/web/lib/get-tenant.ts` — requireTenantContext()
- `apps/web/lib/auth.ts` — Better Auth server
- `apps/web/app/(dashboard)/layout.tsx` — Dashboard layout (extend with sidebar)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireTenantContext()` — server-side tenant scoping (Phase 2)
- `getTenantDb(tenantId)` — scoped database access
- Hub HTTP API routes — /send, /runs/start, /runs/stop (Phase 3)
- Event store + Redis publisher (Phase 3)
- Message envelope Zod schemas in packages/shared
- Dashboard layout with sign-out (Phase 2)
- shadcn/ui components initialized

### Established Patterns
- Drizzle tenant schema factory — extend with new tables
- Server actions / API routes with requireTenantContext()
- Hub communication via internal Docker network HTTP

### Integration Points
- Browser → SSE (GET /api/runs/[id]/stream) → Redis subscriber → events
- Browser → API routes → Hub HTTP API → Agent WebSocket → Mo
- Mo → Hub → event store + Redis → SSE → browser
- Artifacts: Hub → MinIO → presigned URL → browser download

</code_context>

<specifics>
## Specific Ideas

- The plan approval card should look like the wireframe: gold border, plan title, cost + duration stats, Approve (gold) and Reject (ghost) buttons
- Question cards should have the gold "Question for you" header from the wireframe
- The sidebar project list should match the wireframe layout (project names, active indicator, question queue badge)
- Keep the transcript simple for now — just a message list. Scenes, collapse, TLDR come in Phase 5.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-research-sprint-workflow*
*Context gathered: 2026-04-21*
