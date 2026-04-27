# Requirements: Beagle Agent Console

**Defined:** 2026-04-21
**Core Value:** Users can observe multi-agent reasoning in real time, steer it at governance gates, and share the full replay externally.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Tenancy

- [x] **AUTH-01**: User can sign up with email and password (invite-only — admin creates invitation)
- [x] **AUTH-02**: User can log in and session persists across browser refresh (database sessions, not JWT)
- [x] **AUTH-03**: User can enable MFA / 2FA on their account
- [x] **AUTH-04**: User can log out from any page
- [x] **AUTH-05**: Admin can invite users to a tenant via email
- [x] **AUTH-06**: Tenant isolation enforced at middleware layer — every request scoped to tenant schema before business logic runs
- [x] **AUTH-07**: Per-tenant PostgreSQL schema provisioned via admin script
- [x] **AUTH-08**: Organization-based tenancy via Better Auth Organizations plugin (org = tenant)

### Agent Connection

- [x] **CONN-01**: Agent Connection Hub connects to OpenClaw agents on Agents VPS via WebSocket
- [ ] **CONN-02**: Console channel plugin built and deployed on Mo (OpenClaw integration)
- [x] **CONN-03**: Messages assigned monotonic sequence numbers at Hub before persistence/broadcast
- [x] **CONN-04**: WebSocket reconnection with exponential backoff + jitter (browser and agent connections)
- [x] **CONN-05**: Message persistence to event store (PostgreSQL) before broadcasting
- [x] **CONN-06**: Redis pub/sub bridge between Agent Hub and Next.js SSE endpoints

### Research Sprint Workflow

- [x] **WORK-01**: User can create a new project
- [x] **WORK-02**: User can start a research sprint by sending a prompt to Mo
- [x] **WORK-03**: Mo generates a plan with cost estimate; user sees plan-approval card
- [x] **WORK-04**: Run does not proceed (no API spend) until user approves the plan
- [x] **WORK-05**: Agents queue clarifying questions instead of self-authorizing; user sees question queue
- [x] **WORK-06**: User can answer queued questions inline in the transcript
- [x] **WORK-07**: User can stop a running sprint via single Stop button in Clean mode
- [x] **WORK-08**: Run state machine tracks transitions: pending → planned → approved → executing → completed/cancelled
- [x] **WORK-09**: Completed run delivers artifacts (files) that user can view and download

### Transcript UI

- [x] **TRAN-01**: Real-time streaming transcript via SSE — agent messages appear as they're produced
- [x] **TRAN-02**: Agent names and roles visible in transcript (color-coded per wireframes: Mo=gold, Jarvis=teal, Sentinel=purple, User=blue)
- [x] **TRAN-03**: Scene auto-naming — transcript organized into labeled scenes with dividers
- [x] **TRAN-04**: Scene collapse — long inter-agent exchanges collapsed behind "X and Y exchanged N messages" fold in Clean mode
- [x] **TRAN-05**: Live TLDR banner at top of project — running summary of "Where we are"
- [x] **TRAN-06**: Virtualized message list for long transcripts (react-virtuoso or equivalent)
- [x] **TRAN-07**: Writers' Room as the primary transcript view

### Clean & Studio Modes

- [x] **MODE-01**: Clean mode is the default — agent names visible, scenes collapsed, single Stop button, no power tools
- [x] **MODE-02**: Studio mode toggle in header — process drawer, @-mention bar, verbosity dial, Interrupt button, fork button
- [x] **MODE-03**: No role-gating — every Year-1 user can toggle between Clean and Studio
- [x] **MODE-04**: Process drawer in Studio shows sentinel data, cost tracking, fork/branch info
- [x] **MODE-05**: @-mention allows directing messages to specific agents in Studio
- [x] **MODE-06**: Interrupt button in Studio allows stopping a specific agent mid-flight

### Artifacts & History

- [x] **ARTF-01**: Artifacts stored in MinIO with bucket-per-tenant isolation
- [x] **ARTF-02**: Artifact card in transcript with filename, size, inline preview for docx/pdf
- [x] **ARTF-03**: User can download artifacts from completed runs
- [x] **ARTF-04**: Run history page with search and status filters (pending/running/completed/cancelled)
- [x] **ARTF-05**: Per-run cost visibility (read from LiteLLM metrics)

### Replay & Sharing

- [x] **REPL-01**: Replay share-link — tokenized URL scoped to Clean-mode content only
- [x] **REPL-02**: Share links are revocable by tenant admin
- [x] **REPL-03**: Share links expire (default 30 days, configurable per tenant)
- [x] **REPL-04**: External viewers see Writers' Room transcript — no sentinel data, no drawer, no Studio signals
- [x] **REPL-05**: Every replay view logged to customer audit view (viewer, timestamp, IP)
- [x] **REPL-06**: Content filtering at renderer level — share-link API returns Clean-mode projection only (server-side, not client-side hiding)

### Mobile & PWA

- [x] **MOBI-01**: Responsive layout works on mobile browsers (Tailwind responsive)
- [x] **MOBI-02**: PWA manifest + service worker for installable app shell
- [x] **MOBI-03**: Push notifications for question-queue items and plan-approval requests
- [x] **MOBI-04**: Mobile question queue view — answer agent questions from phone
- [x] **MOBI-05**: Overnight digest view — summary of what happened while user was away

### Operator & Sentinel

- [x] **OPER-01**: Tenant provisioning via admin script (create tenant schema, seed config, invite first user)
- [x] **OPER-02**: Operator console web UI — system health, running agents, active runs, cost overview
- [x] **OPER-03**: Sentinel Phase A — passive logging of agent behavior (drift scores, quality signals)
- [x] **OPER-04**: Sentinel pane visible in Studio mode for operator-role users
- [x] **OPER-05**: Break-glass flow — operator can access tenant conversation content with time-boxed authorization
- [x] **OPER-06**: Customer-visible audit log — tenant admin sees when operator accessed their data

### Infrastructure & Deployment

- [ ] **INFR-01**: Docker Compose deployment on BeagleHQ VPS (three containers: web, agent-hub, worker)
- [ ] **INFR-02**: Caddy reverse proxy config for console.beaglemind.ai with auto-TLS
- [ ] **INFR-03**: Docker memory limits on all containers (VPS has ~5GB available for console)
- [ ] **INFR-04**: CI/CD pipeline (GitHub Actions → deploy to BeagleHQ)
- [x] **INFR-05**: Monorepo structure: apps/web, apps/agent-hub, apps/worker, packages/db, packages/shared
- [x] **INFR-06**: Per-tenant Obsidian vault wiring (agents read/write through tenant-aware path resolver)

### UI Polish (from Phase 11 UAT)

- [x] **UAT-12-01**: Run History page renders in dark theme on first paint and after hydration, matching every other dashboard view (verified 2026-04-27)
- [x] **UAT-12-02**: Writers' Room shows an agent-aware loading skeleton when a run has 0 streamed events (verified 2026-04-27 after the Virtuoso footer fix)
- [x] **UAT-12-03**: Every transcript-visible agent (Mo, Jarvis, Herman, Sam) is configured in `AGENT_CONFIG` with capitalized display name, role label, avatar color, and name color; speaker block in `AgentMessage` is visually distinct from body prose (verified 2026-04-27)
- [x] **UAT-12-04**: Run page header displays the run's prompt as a single-line truncated title above the status chip + UUID row (verified 2026-04-27; subsequently superseded by UAT-13-02's AI-generated titles, with truncated prompt as fallback)

### UI Polish R2 + Tabs Redesign + Settings (from post-Phase-12 UAT)

- [x] **UAT-13-01**: Run page never produces a horizontal scrollbar at viewport widths ≥1024px (verified 2026-04-27)
- [ ] **UAT-13-02**: Each new run gets a 6–8 word AI-generated title via Haiku-on-LiteLLM, stored on `runs.title`; UI shows it in run page header and Run History "Title" column, with truncated-prompt fallback. **Code complete; runtime-blocked by LiteLLM outage on BeagleHQ (Prisma auth failure). UI fallback to truncated prompt is working as designed. Reopens when LiteLLM is fixed — see backlog.**
- [ ] **UAT-13-03**: Composer "Improve" button (Sparkles icon, left of Send) opens a popover; `POST /api/runs/improve-prompt` calls Haiku via LiteLLM and returns `{rewritten}`. **Code complete; runtime-blocked by same LiteLLM outage — endpoint returns 500. Popover UI verified working. Reopens when LiteLLM is fixed.**
- [x] **UAT-13-04**: Speaker chip / avatar in `AgentMessage` is offset ≥16px from message-list panel's left edge (verified 2026-04-27)
- [x] **UAT-13-05**: Run header shows `#xxxxxxxx` short slug (first 8 chars of UUID) in monospace; click copies full UUID with 1.5s confirmation; full UUID accessible via `title=` (verified 2026-04-27)
- [x] **UAT-13-06**: `/settings` route renders auth-gated form with `theme` / `defaultTab` / `defaultVerbosity` / `browserNotifications`; persists to `users.preferences` JSONB via `PATCH /api/me/preferences`; theme switching reverts Plan 12-01's `:root`-as-dark hack (verified 2026-04-27)
- [x] **UAT-13-07**: Each tab visibly differentiated — Timeline play/pause/scrub bar with 1× / 2× / 4× speed and per-event playhead; Boardroom is a scene-aligned grid; Canvas first-class empty-state card when `artifacts.length === 0` (verified 2026-04-27)

### Track B Bugs — Run Lifecycle + Timestamps (Phase 14)

- [x] **UAT-14-01**: Historical events in the Writers' Room transcript render their timestamps as relative time (e.g., "5d ago", "13:42") — never `NaN:NaN`. Fix is in the SSE replay path at `apps/web/app/api/runs/[id]/stream/route.ts`: shape the DB row into a `HubEventEnvelope` (mapping `createdAt → timestamp`) before serializing.
- [ ] **UAT-14-02**: Runs transition to `completed` when the round-table discussion ends. Hub appends the terminal status update to `runs.status` and emits a `state_transition` event after the agent for-loop finishes.
- [ ] **UAT-14-03**: No legacy orphan `pending` runs remain in Run History after deploy. One-shot SQL backfill marks any `pending` run older than 1 day as `cancelled`. The `migrate-13.ts` tenant-discovery bug (reading `shared.tenants` instead of `shared.organizations`) is fixed at the same time so the backfill can iterate every tenant.

### Visual Overhaul (Phase 16)

- [x] **UAT-16-01**: Dashboard header shows italic-accent wordmark "Beagle Agent *Console*" with logo + system pulse dot indicating live activity in the last 60s; operator users see LiteLLM ↗ + Grafana ↗ links; non-run dashboard pages show a `BEAGLELABS › <PAGE>` breadcrumb
- [ ] **UAT-16-02**: Sidebar shows AGENTS section with mo/jarvis/herman/sam rows (avatar + name + role + presence dot — live ≤60s, ready ≤30min, offline otherwise); clicking a row filters Run History to that agent via `?agent=<id>`; PROJECTS section is collapsible with last 5 runs inline; bottom nav-icon row preserves Run History / Shared Links / Questions / Settings
- [ ] **UAT-16-03**: Run History `/runs` shows a 4-card KPI strip at top — Total Runs / Total Spend / Avg Cost per Run / Completed Today — backed by a new `GET /api/runs/history/summary` endpoint; status chips render rounded-full; row hover reveals a chevron affordance
- [ ] **UAT-16-04**: Agent roles in `AGENT_CONFIG` are rebranded — Mo: "Governance" · Jarvis: "Commercial Risk" · Herman: "Stress-Test" · Sam: "Sentinel"; surfaces everywhere `getAgentConfig().role` is read (speaker chips, sidebar, cost section, interrupt button)
- [ ] **UAT-16-05**: Run page header has a single tabular metadata row (`STATUS · #slug · duration · cost · agents · events · timestamp`); Stop/Share buttons are ghost-style icon-only with tooltips; tabs use rounded-pill styling matching the system's mode toggle

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Views

- **VIEW-01**: Timeline view — scrubbable horizontal replay of a run
- **VIEW-02**: Boardroom view — parallel agent columns (one per agent)
- **VIEW-03**: Canvas view — artifact-first doc surface with agent margin comments

### Advanced Governance

- **GOVR-01**: Red-team button on completed runs (spawns Run with kind=red_team_pass)
- **GOVR-02**: Mo auto-invoked counterpoint at plan and first-draft beats (mechanism 2 of §6)
- **GOVR-03**: Three-mechanism disagreement system fully wired

### Enterprise

- **ENTR-01**: SSO integration
- **ENTR-02**: Billing system (per-seat / per-project / per-agent-month)
- **ENTR-03**: Per-tenant cost ceiling with model fallback alarm
- **ENTR-04**: Dedicated-VPS tier for enterprise customers
- **ENTR-05**: Sentinel Phase B (rule-based flags)
- **ENTR-06**: Sentinel Phase C (baseline scoring)

### Quality of Life

- **QUAL-01**: File attachment handling in user messages
- **QUAL-02**: Artifact versioning (multiple drafts per run)
- **QUAL-03**: Fork button — branch a run from any point (Studio)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Additional workflows beyond research sprint | Singular focus until Product Proof gate passes; red-team is a Run.kind variant |
| Role-gated UI (Clean-only / Studio-only users) | All Year-1 users get both modes |
| White-label / custom agent personas | Premature customization |
| Native mobile app | PWA only through v2 |
| Freeform chat with Mo | Defeats governance model |
| Real-time multi-user collaboration | Complexity doesn't justify for v1 |
| Multi-region HA | Single Hetzner VPS sufficient for Year 1 |
| Slack/email integrations | Focus on core loop first |
| Design refresh beyond shadcn | Real designer engagement later |
| Consumer market / free tier | Enterprise-only positioning |
| Vercel AI SDK | Wrong abstraction — observes OpenClaw agents, not direct LLM calls |
| Per-tenant connection pools | Will OOM on 8GB VPS; shared pool with schema scoping instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| AUTH-07 | Phase 2 | Complete |
| AUTH-08 | Phase 2 | Complete |
| CONN-01 | Phase 3 | Complete |
| CONN-02 | Phase 3 | Pending |
| CONN-03 | Phase 3 | Complete |
| CONN-04 | Phase 3 | Complete |
| CONN-05 | Phase 3 | Complete |
| CONN-06 | Phase 3 | Complete |
| WORK-01 | Phase 4 | Complete |
| WORK-02 | Phase 4 | Complete |
| WORK-03 | Phase 4 | Complete |
| WORK-04 | Phase 4 | Complete |
| WORK-05 | Phase 4 | Complete |
| WORK-06 | Phase 4 | Complete |
| WORK-07 | Phase 4 | Complete |
| WORK-08 | Phase 4 | Complete |
| WORK-09 | Phase 4 | Complete |
| TRAN-01 | Phase 5 | Complete |
| TRAN-02 | Phase 5 | Complete |
| TRAN-03 | Phase 5 | Complete |
| TRAN-04 | Phase 5 | Complete |
| TRAN-05 | Phase 5 | Complete |
| TRAN-06 | Phase 5 | Complete |
| TRAN-07 | Phase 5 | Complete |
| MODE-01 | Phase 6 | Complete |
| MODE-02 | Phase 6 | Complete |
| MODE-03 | Phase 6 | Complete |
| MODE-04 | Phase 6 | Complete |
| MODE-05 | Phase 6 | Complete |
| MODE-06 | Phase 6 | Complete |
| ARTF-01 | Phase 7 | Complete |
| ARTF-02 | Phase 7 | Complete |
| ARTF-03 | Phase 7 | Complete |
| ARTF-04 | Phase 7 | Complete |
| ARTF-05 | Phase 7 | Complete |
| REPL-01 | Phase 8 | Complete |
| REPL-02 | Phase 8 | Complete |
| REPL-03 | Phase 8 | Complete |
| REPL-04 | Phase 8 | Complete |
| REPL-05 | Phase 8 | Complete |
| REPL-06 | Phase 8 | Complete |
| MOBI-01 | Phase 10 | Complete |
| MOBI-02 | Phase 10 | Complete |
| MOBI-03 | Phase 10 | Complete |
| MOBI-04 | Phase 10 | Complete |
| MOBI-05 | Phase 10 | Complete |
| OPER-01 | Phase 9 | Complete |
| OPER-02 | Phase 9 | Complete |
| OPER-03 | Phase 9 | Complete |
| OPER-04 | Phase 9 | Complete |
| OPER-05 | Phase 9 | Complete |
| OPER-06 | Phase 9 | Complete |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 1 | Pending |
| INFR-05 | Phase 1 | Complete |
| INFR-06 | Phase 1 | Complete |
| VIEW-01 | Phase 11 | Complete |
| VIEW-02 | Phase 11 | Complete |
| VIEW-03 | Phase 11 | Complete |
| UAT-12-01 | Phase 12 | Pending |
| UAT-12-02 | Phase 12 | Complete |
| UAT-12-03 | Phase 12 | Complete |
| UAT-12-04 | Phase 12 | Pending |

**Coverage:**
- v1 requirements: 68 total
- Mapped to phases: 68
- Unmapped: 0

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after roadmap creation*
