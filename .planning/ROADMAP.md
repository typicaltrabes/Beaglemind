# Roadmap: Beagle Agent Console

## Overview

Build an observable reasoning console that replaces WhatsApp-based agent coordination with a structured, governed, shareable interface. The journey moves from infrastructure foundation through the core agent loop (connect agents, run research sprints, stream transcripts), layers on UX modes and artifact management, then extends to replay sharing, operator tooling, and mobile access. Every phase delivers a coherent, verifiable capability that builds toward the Product Proof gate.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Infrastructure** - Monorepo scaffold, Docker Compose, Caddy, CI/CD, database schema, MinIO, vault wiring
- [ ] **Phase 2: Authentication & Tenancy** - User auth with Better Auth, MFA, org-based multi-tenancy with per-tenant schema isolation
- [ ] **Phase 3: Agent Connection Hub** - Node WebSocket service bridging OpenClaw agents to the console via Redis pub/sub
- [ ] **Phase 4: Research Sprint Workflow** - End-to-end run lifecycle: prompt, plan approval, question queue, execution, completion
- [ ] **Phase 5: Transcript UI** - Real-time streaming transcript with scenes, collapse, TLDR, and virtualized rendering
- [ ] **Phase 6: Clean & Studio Modes** - Default Clean mode, Studio toggle with process drawer, @-mention, interrupt, verbosity
- [ ] **Phase 7: Artifacts & Run History** - MinIO artifact storage, inline preview, download, run history with search and cost
- [ ] **Phase 8: Replay & Sharing** - Tokenized share links scoped to Clean-mode content, revocable, time-boxed, audit-logged
- [x] **Phase 9: Operator Console & Sentinel** - Tenant provisioning, operator dashboard, sentinel passive logging, break-glass with audit (completed 2026-04-21)
- [x] **Phase 10: Mobile PWA** - Installable PWA, push notifications, mobile question queue, overnight digest (completed 2026-04-21)
- [ ] **Phase 11: Run-view tabs (Writers' Room, Timeline, Boardroom, Canvas)** - Four-tab switcher on the run view page, read-only over existing run-store
- [ ] **Phase 12: UI Polish from Phase 11 UAT** - Track A look-and-feel fixes: dark Run History, Writers' Room loading skeleton, speaker chips with full agent config, prompt-as-run-title
- [ ] **Phase 13: UI Polish R2 + Tabs Redesign + Settings + Title Summarization** - Seven items from post-Phase-12 UAT: kill horizontal scroll, avatar-edge padding, prettier run-id chip, run-title summarization (Haiku via LiteLLM), settings page (theme/defaultTab/verbosity/notifications), Improve-prompt button scaffold, Timeline scrubber + Boardroom scene-grid + Canvas empty state
- [ ] **Phase 14: Track B Bugs — Run Lifecycle + Timestamps** - Fix NaN:NaN timestamps on historical events (SSE replay missing `createdAt → timestamp` map), runs stuck on `executing` because hub never marks them `completed`, and 18 orphan `pending` runs. Folds in the migrate-13 tenant-discovery fix.
- [ ] **Phase 16: Visual Overhaul** - 5 tracks of brand/density polish from afternoon UAT + sister-site references: italic-accent header + system pulse + operator LiteLLM/Grafana links, agent-roster sidebar with presence + filter-by-agent, Run History KPI strip, agent role rebrand (Governance / Commercial Risk / Stress-Test), run page metadata row + pill tabs.
- [ ] **Phase 17: User Attachments — Documents & Images to Agents** - Three tracks: composer paperclip + drag-drop, MinIO upload + text extraction (pdf-parse + mammoth, already in repo from Phase 7), and agent context delivery via prompt prepend. PDF / DOCX / PNG / JPG / WEBP / TXT / MD; max 20 MB / 4 files per message.

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: Project skeleton is deployable on BeagleHQ with all services running, CI/CD pushing updates, and tenant database structure ready
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-06
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` on BeagleHQ starts web, agent-hub, and worker containers without errors
  2. Visiting console.beaglemind.ai in a browser returns a page served through Caddy with valid TLS
  3. Pushing to main on GitHub triggers a CI/CD pipeline that deploys to BeagleHQ automatically
  4. Monorepo structure exists with apps/web, apps/agent-hub, apps/worker, packages/db, packages/shared and builds cleanly
  5. Tenant schema migration script creates a new per-tenant schema in PostgreSQL and the vault path resolver maps tenant ID to Obsidian vault location
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Monorepo scaffold with all packages, Drizzle schema, tenant utilities, vault resolver
- [ ] 01-02-PLAN.md -- Dockerfiles, Docker Compose, BeagleHQ deployment, Caddy config
- [ ] 01-03-PLAN.md -- GitHub Actions CI/CD pipeline

### Phase 2: Authentication & Tenancy
**Goal**: Users can securely sign in to a tenant-isolated environment where every request is scoped to their organization
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08
**Success Criteria** (what must be TRUE):
  1. Invited user can sign up, log in, and their session persists across browser refresh (database sessions)
  2. User can enable MFA on their account and is challenged on next login
  3. Admin can invite a new user to their tenant via email; that user lands in the correct organization
  4. Every API request is scoped to the tenant schema via middleware -- a user in Tenant A cannot see Tenant B data even by manipulating requests
  5. Tenant provisioning script creates a new org, its PostgreSQL schema, and seeds initial config
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md -- Better Auth schema, server/client config, API route, email utility
- [x] 02-02-PLAN.md -- Auth UI pages (login, no-org, dashboard), edge middleware, tenant context utility
- [x] 02-03-PLAN.md -- MFA setup/challenge, invite acceptance flow, extended provisioning, tenant isolation tests

### Phase 3: Agent Connection Hub
**Goal**: Console can establish and maintain reliable bidirectional communication with OpenClaw agents on the Agents VPS
**Depends on**: Phase 2
**Requirements**: CONN-01, CONN-02, CONN-03, CONN-04, CONN-05, CONN-06
**Success Criteria** (what must be TRUE):
  1. Agent Hub connects to Mo on the Agents VPS via WebSocket and receives messages
  2. Console channel plugin is deployed on Mo and Mo can send structured messages to the Hub
  3. Messages arrive at the Hub with monotonic sequence numbers and are persisted to PostgreSQL before being broadcast
  4. When a WebSocket connection drops, it reconnects automatically with exponential backoff and jitter
  5. Messages published by Agent Hub appear on Redis pub/sub channels and are consumable by Next.js SSE endpoints
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Shared types, events schema, Hub connection layer with reconnect, health/status endpoints
- [ ] 03-02-PLAN.md -- OpenClaw WebSocket plugin deployment on Agents VPS (Mo, Sam, Herman)
- [x] 03-03-PLAN.md -- Event persistence, sequence numbering, Redis pub/sub bridge, message routing, HTTP API

### Phase 4: Research Sprint Workflow
**Goal**: A user can run a complete research sprint from prompt to delivered artifacts, with governance gates (plan approval, question queue) enforced throughout
**Depends on**: Phase 3
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, WORK-07, WORK-08, WORK-09
**Success Criteria** (what must be TRUE):
  1. User can create a project and start a research sprint by sending a prompt to Mo
  2. Mo returns a plan with cost estimate; user sees a plan-approval card and no API spend occurs until they approve
  3. When agents have clarifying questions, they appear in a question queue and user can answer them inline
  4. User can stop a running sprint with a single Stop button and the run transitions to cancelled
  5. Completed run delivers downloadable artifacts and the run state machine correctly tracks all transitions (pending through completed/cancelled)
**Plans**: 6 plans
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md -- Schema extension (6 domain tables), dependencies, shadcn init, state machine, Hub client
- [x] 04-02-PLAN.md -- Hub API gaps: /runs/approve, /runs/questions/answer routes, fix /runs/start transition
- [x] 04-03-PLAN.md -- Next.js API routes (projects, runs, approve, stop, answer, SSE stream, artifact download)
- [x] 04-04-PLAN.md -- Zustand stores, SSE hook, TanStack Query hooks, QueryProvider
- [x] 04-05-PLAN.md -- Dashboard layout with sidebar, project list, question queue, project/run pages
- [x] 04-06-PLAN.md -- Transcript components: plan card, question card, artifact card, message list, composer

### Phase 5: Transcript UI
**Goal**: Users can watch agents think out loud in a real-time streaming transcript organized into named, collapsible scenes with a live summary
**Depends on**: Phase 4
**Requirements**: TRAN-01, TRAN-02, TRAN-03, TRAN-04, TRAN-05, TRAN-06, TRAN-07
**Success Criteria** (what must be TRUE):
  1. Agent messages stream into the transcript in real time via SSE -- no page refresh needed
  2. Each agent is visually identifiable by name, role, and color (Mo=gold, Jarvis=teal, Sentinel=purple, User=blue)
  3. Transcript auto-segments into labeled scenes with dividers; long inter-agent exchanges collapse behind a fold in Clean mode
  4. A live TLDR banner at the top of the project shows a running summary of current status
  5. Long transcripts (500+ messages) scroll smoothly via virtualized rendering
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md -- Event types + agent config + scene grouping + avatar/message/divider components
- [x] 05-02-PLAN.md -- Collapse fold algorithm/component + TLDR banner component
- [x] 05-03-PLAN.md -- react-virtuoso MessageList rewrite + Writers Room integration in run page

### Phase 6: Clean & Studio Modes
**Goal**: Users can switch between a streamlined Clean reading mode and a power-user Studio mode with full process visibility and agent control
**Depends on**: Phase 5
**Requirements**: MODE-01, MODE-02, MODE-03, MODE-04, MODE-05, MODE-06
**Success Criteria** (what must be TRUE):
  1. Clean mode is the default experience -- scenes collapsed, single Stop button, no power tools visible
  2. User can toggle to Studio mode via header control and immediately sees process drawer, @-mention bar, verbosity dial, and interrupt button
  3. Process drawer in Studio displays sentinel data, per-agent cost tracking, and fork/branch info in real time
  4. User can @-mention a specific agent to direct a message to them, and interrupt a specific agent mid-flight
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md -- Mode context provider, header toggle, mode-aware collapse-fold and composer with Studio controls
- [x] 06-02-PLAN.md -- Process drawer (sentinel, cost, fork sections), interrupt button, run page layout integration

### Phase 7: Artifacts & Run History
**Goal**: Users can browse their run history, view delivered artifacts with inline previews, and track per-run costs
**Depends on**: Phase 4
**Requirements**: ARTF-01, ARTF-02, ARTF-03, ARTF-04, ARTF-05
**Success Criteria** (what must be TRUE):
  1. Artifacts are stored in MinIO with bucket-per-tenant isolation and user can download them from completed runs
  2. Artifact cards appear in the transcript with filename, size, and inline preview for docx/pdf files
  3. Run history page lists all runs with search and status filters (pending/running/completed/cancelled)
  4. Each run displays its total cost sourced from LiteLLM metrics
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 07-01-PLAN.md -- Artifact preview: mammoth DOCX conversion API, PDF iframe preview, slide-over panel, extended artifact card
- [x] 07-02-PLAN.md -- Run history page: API with joins/filters, table with status/cost/search, cost badge, sidebar nav

### Phase 8: Replay & Sharing
**Goal**: Users can generate tokenized share links that let external viewers watch a Clean-mode replay of any completed run, with full audit trail
**Depends on**: Phase 5, Phase 7
**Requirements**: REPL-01, REPL-02, REPL-03, REPL-04, REPL-05, REPL-06
**Success Criteria** (what must be TRUE):
  1. User can generate a share link for a completed run; the link is a tokenized URL that expires after 30 days (configurable)
  2. External viewer sees the Writers' Room transcript in Clean mode only -- no sentinel data, no drawer, no Studio signals
  3. Content filtering happens server-side at the renderer level -- the share-link API returns a Clean-mode projection, not client-side hiding
  4. Tenant admin can revoke any share link and every replay view is logged with viewer, timestamp, and IP in a customer audit view
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 08-01-PLAN.md -- Schema (share_links + replay_views), share link generation/revocation API, share dialog on run page
- [x] 08-02-PLAN.md -- Public replay page with server-side Clean-mode event filtering and view logging
- [x] 08-03-PLAN.md -- Shared links management page with revocation controls and audit log views

### Phase 9: Operator Console & Sentinel
**Goal**: Operators can monitor system health, provision tenants, observe agent behavior via sentinel logging, and access tenant data through audited break-glass
**Depends on**: Phase 3
**Requirements**: OPER-01, OPER-02, OPER-03, OPER-04, OPER-05, OPER-06
**Success Criteria** (what must be TRUE):
  1. Operator can provision a new tenant via admin script (create schema, seed config, invite first user)
  2. Operator console shows system health, running agents, active runs, and cost overview in a web UI
  3. Sentinel Phase A passively logs agent behavior (drift scores, quality signals) and the sentinel pane is visible in Studio mode for operator-role users
  4. Operator can perform break-glass access to tenant conversation content with time-boxed authorization, and the tenant admin sees an entry in their audit log
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 09-01-PLAN.md -- CLI provisioning script, operator role flag, break-glass audit schema, sentinel data flow
- [x] 09-02-PLAN.md -- Operator dashboard with health cards, stats, active runs, aggregated sentinel view
- [x] 09-03-PLAN.md -- Break-glass access flow with time-boxed authorization and customer audit log

### Phase 10: Mobile PWA
**Goal**: Users can install the console as a mobile app, receive push notifications for governance events, and handle question queue and digest from their phone
**Depends on**: Phase 4
**Requirements**: MOBI-01, MOBI-02, MOBI-03, MOBI-04, MOBI-05
**Success Criteria** (what must be TRUE):
  1. Console layout is responsive and usable on mobile browsers
  2. User can install the console as a PWA from their phone's browser (manifest + service worker)
  3. User receives push notifications when a plan needs approval or a question is queued
  4. User can answer agent questions from the mobile question queue view
  5. Overnight digest view summarizes what agents did while the user was away
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 10-01-PLAN.md -- Responsive layout: hamburger sidebar, sticky composer, mobile process drawer overlay
- [x] 10-02-PLAN.md -- PWA manifest + Serwist service worker, push notifications via VAPID/web-push
- [x] 10-03-PLAN.md -- Mobile landing page with question queue cards, quick-answer, and overnight digest

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
Note: Phase 7 and Phase 9 depend on Phase 4 and Phase 3 respectively, not on Phase 6. After Phase 6, phases 7-10 could theoretically parallelize but will execute sequentially.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 1/3 | Planned | - |
| 2. Authentication & Tenancy | 3/3 | Planned | - |
| 3. Agent Connection Hub | 2/3 | Planned | - |
| 4. Research Sprint Workflow | 6/6 | Planned | - |
| 5. Transcript UI | 0/3 | Planned | - |
| 6. Clean & Studio Modes | 0/2 | Planned | - |
| 7. Artifacts & Run History | 0/2 | Planned | - |
| 8. Replay & Sharing | 0/3 | Planned | - |
| 9. Operator Console & Sentinel | 3/3 | Complete   | 2026-04-21 |
| 10. Mobile PWA | 3/3 | Complete   | 2026-04-21 |

### Phase 11: Run-view tabs: Writers' Room, Timeline, Boardroom, Canvas

**Goal:** Ship a four-tab switcher on the run view page so users can look at the same run as transcript (Writers' Room), scrubbable horizontal timeline (Timeline), parallel agent columns (Boardroom), or artifact-first doc with margin comments (Canvas). Read-only over existing run-store — no backend, SSE, or schema changes.
**Requirements**: VIEW-01, VIEW-02, VIEW-03
**Depends on:** Phase 10
**Plans:** 5 plans

Plans:
- [x] 11-01-PLAN.md — Scaffold tabs primitive, shared helpers (agent-colors, renderEvent), URL-synced tab switcher, and Writers' Room tab wired into run page
- [x] 11-02-PLAN.md — Timeline view: horizontal dot lane with scene dividers, hover tooltip, click-to-detail panel, scrubber (VIEW-01)
- [x] 11-03-PLAN.md — Boardroom view: parallel agent columns on desktop, mobile accordion fallback (VIEW-02)
- [x] 11-04-PLAN.md — Canvas view: artifact-first preview with proximity-based margin comments, extract ArtifactPreviewInline (VIEW-03)
- [ ] 11-05-PLAN.md — Deploy to console.beaglemind.ai and human UAT checkpoint

### Phase 12: UI Polish from Phase 11 UAT

**Goal:** Close the four look-and-feel defects surfaced by Lucas's 2026-04-27 UAT pass against console.beaglemind.ai: (1) Run History rendering in light theme while everything else is dark, (2) Writers' Room "waiting" state showing as a dead screen, (3) speaker attribution being weak in single-column Writers' Room (incl. unconfigured `herman` rendering lowercase + gray), (4) run page header showing only the UUID with no human-readable title. Track A scope only — Track B (run lifecycle, artifact counts, status/cost mismatch) is deferred.
**Requirements:** UAT-12-01, UAT-12-02, UAT-12-03, UAT-12-04
**Depends on:** Phase 11
**Plans:** 2/5 plans executed

Plans: *(to be created via `/gsd-plan-phase 12`)*

### Phase 13: UI Polish R2 + Tabs Redesign + Settings + Title Summarization

**Goal:** Address all 7 items from Lucas's post-Phase-12 UAT in one autonomous phase: (1) kill the horizontal scrollbar on the run page; (2) generate a 6–8 word title for each run via Haiku and replace the raw prompt as the run header; (3) scaffold an "Improve my prompt" composer button + 501 stub endpoint (real LLM wiring deferred to Phase 14); (4) indent avatars away from the panel edge; (5) replace raw run UUID with `#xxxxxxxx` short slug + click-to-copy; (6) build a `/settings` page with theme / default-tab / default-verbosity / notifications, backed by a `users.preferences` JSONB column; (7) make the four run-view tabs visibly different — Timeline gets a real scrub/play bar, Boardroom becomes a scene-aligned agents-vs-scenes grid, Canvas gets a first-class empty state.
**Requirements:** UAT-13-01, UAT-13-02, UAT-13-03, UAT-13-04, UAT-13-05, UAT-13-06, UAT-13-07
**Depends on:** Phase 12
**Plans:** 7 plans

Plans:
- [ ] 13-01-PLAN.md — Schema additions (runs.title + users.preferences) + idempotent migration script + API/hook field exposure
- [ ] 13-02-PLAN.md — Run page UI bugs: horizontal scroll fix (item 1) + avatar edge padding (item 4) + RunIdChip with click-to-copy (item 5)
- [ ] 13-03-PLAN.md — Run title summarization: liteLLMComplete helper + generateRunTitle fire-and-forget + run page h1 fallback + Run History column rename (item 2)
- [ ] 13-04-PLAN.md — Improve-prompt button: POST /api/runs/improve-prompt (auth + Zod + rate-limit) + ImprovePromptPopover + Composer Sparkles button (item 3)
- [ ] 13-05-PLAN.md — Settings page + theme switching: PreferencesSchema + /api/me/preferences + /settings form + ThemeProvider + globals.css :root revert + RunViewTabs/Composer/PushPermission consumers (item 6)
- [ ] 13-06-PLAN.md — Tab differentiation: Timeline scrub/play bar + Boardroom scene-aligned grid + Canvas first-class empty state + shared EmptyState component (item 7)
- [ ] 13-07-PLAN.md — Deploy to console.beaglemind.ai + apply Phase 13 schema migration + human UAT checkpoint covering all seven UAT-13-* requirements

### Phase 14: Track B Bugs — Run Lifecycle + Timestamps

**Goal:** Close three production bugs deferred from Phase 12 UAT: (1) every transcript message renders `NaN:NaN` for its timestamp because the SSE replay endpoint serializes the raw DB row (which has `createdAt`, not `timestamp`); (2) every run is stuck on `executing` for days because the hub round-table never updates `runs.status` to `completed`; (3) 18 orphan `pending` runs sit at the top of Run History from earlier dev. Side fix: `migrate-13.ts`'s tenant lookup reads the wrong table (`shared.tenants` instead of `shared.organizations`) — fixed at the same time so future tenants inherit Phase 13 schema and Phase 14 backfill.
**Requirements:** UAT-14-01, UAT-14-02, UAT-14-03
**Depends on:** Phase 13
**Plans:** 2/4 plans executed

Plans:
- [x] 14-01-PLAN.md — Bug 1 (UAT-14-01): SSE replay envelope shaping — extract dbRowToEnvelope helper with unit tests, wire into apps/web/app/api/runs/[id]/stream/route.ts so historical events carry an ISO timestamp
- [x] 14-02-PLAN.md — Bug 2 (UAT-14-02): Hub round-table completion — add db imports + terminal completion block (DB update + state_transition emission) to apps/agent-hub/src/http/routes.ts:runRoundTable
- [ ] 14-03-PLAN.md — Bug 3 (UAT-14-03): migrate-13.ts tenant-discovery fix (shared.tenants → shared.organizations) + per-tenant cancelled-backfill block (pending older than 1 day → cancelled)
- [ ] 14-04-PLAN.md — Deploy + UAT: pre-flight typecheck/vitest, push, ssh beaglehq, run migrate-13.ts, rebuild console-web AND console-agent-hub, smoke checks, human-verify checkpoint covering UAT-14-01..03


### Phase 16: Visual Overhaul

**Goal:** Five visual overhaul tracks shipped in one phase, all from Lucas's late-afternoon UAT against sister-site references (Sonic Care 'Agenten Zentrale', Mo OpenClaw chat UI). Track 1 — italic-accent header with system pulse + operator LiteLLM/Grafana links + breadcrumb on dashboard pages. Track 2 — sidebar redesign with agent roster (mo/jarvis/herman/sam) + presence dots + click-to-filter Run History. Track 3 — Run History 4-card KPI strip backed by a new GET /api/runs/history/summary endpoint. Track 4 — agent role rebrand (Mo:Governance / Jarvis:Commercial Risk / Herman:Stress-Test / Sam:Sentinel). Track 5 — run page tabular metadata row + ghost icon-only Stop/Share + rounded-pill tab strip.
**Requirements:** UAT-16-01, UAT-16-02, UAT-16-03, UAT-16-04, UAT-16-05
**Depends on:** Phase 14
**Plans:** 3/6 plans executed

Plans:
- [x] 16-01-PLAN.md — Track 1 (UAT-16-01): system-pulse helper + operator API + Breadcrumb component + dashboard-shell wordmark/logo/pulse/operator-links wiring + breadcrumb on /, /runs, /shared-links
- [x] 16-02-PLAN.md — Track 2 (UAT-16-02): presence helper + AgentRow component + sidebar rewrite (AGENTS / collapsible PROJECTS / nav-icon footer) + extended /api/runs/history with ?agent=<id> filter
- [x] 16-03-PLAN.md — Track 3 (UAT-16-03): /api/runs/history/summary endpoint + useRunHistorySummary hook + KpiCard + RunHistorySummary 4-tile strip + table chip rounded-full + hover chevron + ?agent= URL wiring on /runs page
- [ ] 16-04-PLAN.md — Track 4 (UAT-16-04): four agent role string changes in apps/web/lib/agent-config.ts (Governance / Commercial Risk / Stress-Test / Sentinel)
- [ ] 16-05-PLAN.md — Track 5 (UAT-16-05): run-metadata pure helpers + RunMetadataRow component + run page wiring + RunViewTabs pill styling
- [ ] 16-06-PLAN.md — Deploy to console.beaglemind.ai + smoke checks + human-verify UAT checkpoint covering UAT-16-01..05


### Phase 17: User Attachments — Documents & Images to Agents

**Goal:** Let users attach files to a prompt so agents can read/see them and respond. Three sub-tracks: (1) composer paperclip + drag-drop UI in `apps/web/components/transcript/composer.tsx` with client-side mime/size validation and a chip stack for pending uploads; (2) `POST /api/runs/[id]/attachments` endpoint that uploads to existing MinIO bucket `tenant-${tenantId}` under `runs/${runId}/uploads/${key}.${ext}`, inserts an `artifacts` row with `agent_id='user'`, and runs synchronous text extraction (pdf-parse for PDF, mammoth for DOCX, utf-8 read for TXT/MD, NULL for images) capped at 50K chars persisted to a new `artifacts.extracted_text` column via idempotent migration; (3) round-table prompt prepend with structured `--- USER ATTACHMENTS ---` block before the user prompt, plus base64 image pass-through to OpenClaw for vision-capable agents (textual placeholder fallback if CLI bridge image support proves complex).
**Requirements:** UAT-17-01, UAT-17-02, UAT-17-03
**Depends on:** Phase 14 (run lifecycle), Phase 7 (artifacts + MinIO)
**Plans:** 1/4 plans executed

Plans:
- [x] 17-01-PLAN.md — Track 1 (UAT-17-01): Composer paperclip + drag-drop + chip stack + send-blocking + AttachmentChip + uploadAttachment client + format-size dedupe
- [ ] 17-02-PLAN.md — Track 2 (UAT-17-02): pdf-parse install + Drizzle artifacts.extracted_text column + migrate-17.ts + extractAttachment server module + rate limiter + POST /api/runs/[id]/attachments endpoint
- [ ] 17-03-PLAN.md — Track 3 (UAT-17-03): Messages route accepts attachmentIds, fetches artifacts scoped to run+user, prepends --- USER ATTACHMENTS --- block to prompt (web-only V1 simplification, hub schema unchanged)
- [ ] 17-04-PLAN.md — Deploy + UAT: pre-flight typecheck/vitest, [BLOCKING] migrate-17.ts BEFORE container rebuild, console-web only force-recreate, smoke checks, human-verify checkpoint covering UAT-17-01..03

**Success Criteria**:
1. User can attach up to 4 files (≤20 MB each) of types PDF / DOCX / PNG / JPG / WEBP / TXT / MD via paperclip or drag-drop and see chip-status feedback before Send
2. Files persist to MinIO at `tenant-${tenantId}/runs/${runId}/uploads/...` and `artifacts` row is created with `agent_id='user'` and (for text formats) populated `extracted_text`
3. Agents in the round-table receive the structured `--- USER ATTACHMENTS ---` block prepended to the user prompt and reference the attached content in their replies (verified by manual UAT with a PDF + an image)


