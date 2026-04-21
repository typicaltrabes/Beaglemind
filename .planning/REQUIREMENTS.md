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

- [ ] **WORK-01**: User can create a new project
- [ ] **WORK-02**: User can start a research sprint by sending a prompt to Mo
- [ ] **WORK-03**: Mo generates a plan with cost estimate; user sees plan-approval card
- [ ] **WORK-04**: Run does not proceed (no API spend) until user approves the plan
- [ ] **WORK-05**: Agents queue clarifying questions instead of self-authorizing; user sees question queue
- [ ] **WORK-06**: User can answer queued questions inline in the transcript
- [ ] **WORK-07**: User can stop a running sprint via single Stop button in Clean mode
- [ ] **WORK-08**: Run state machine tracks transitions: pending → planned → approved → executing → completed/cancelled
- [ ] **WORK-09**: Completed run delivers artifacts (files) that user can view and download

### Transcript UI

- [ ] **TRAN-01**: Real-time streaming transcript via SSE — agent messages appear as they're produced
- [ ] **TRAN-02**: Agent names and roles visible in transcript (color-coded per wireframes: Mo=gold, Jarvis=teal, Sentinel=purple, User=blue)
- [ ] **TRAN-03**: Scene auto-naming — transcript organized into labeled scenes with dividers
- [ ] **TRAN-04**: Scene collapse — long inter-agent exchanges collapsed behind "X and Y exchanged N messages" fold in Clean mode
- [ ] **TRAN-05**: Live TLDR banner at top of project — running summary of "Where we are"
- [ ] **TRAN-06**: Virtualized message list for long transcripts (react-virtuoso or equivalent)
- [ ] **TRAN-07**: Writers' Room as the primary transcript view

### Clean & Studio Modes

- [ ] **MODE-01**: Clean mode is the default — agent names visible, scenes collapsed, single Stop button, no power tools
- [ ] **MODE-02**: Studio mode toggle in header — process drawer, @-mention bar, verbosity dial, Interrupt button, fork button
- [ ] **MODE-03**: No role-gating — every Year-1 user can toggle between Clean and Studio
- [ ] **MODE-04**: Process drawer in Studio shows sentinel data, cost tracking, fork/branch info
- [ ] **MODE-05**: @-mention allows directing messages to specific agents in Studio
- [ ] **MODE-06**: Interrupt button in Studio allows stopping a specific agent mid-flight

### Artifacts & History

- [ ] **ARTF-01**: Artifacts stored in MinIO with bucket-per-tenant isolation
- [ ] **ARTF-02**: Artifact card in transcript with filename, size, inline preview for docx/pdf
- [ ] **ARTF-03**: User can download artifacts from completed runs
- [ ] **ARTF-04**: Run history page with search and status filters (pending/running/completed/cancelled)
- [ ] **ARTF-05**: Per-run cost visibility (read from LiteLLM metrics)

### Replay & Sharing

- [ ] **REPL-01**: Replay share-link — tokenized URL scoped to Clean-mode content only
- [ ] **REPL-02**: Share links are revocable by tenant admin
- [ ] **REPL-03**: Share links expire (default 30 days, configurable per tenant)
- [ ] **REPL-04**: External viewers see Writers' Room transcript — no sentinel data, no drawer, no Studio signals
- [ ] **REPL-05**: Every replay view logged to customer audit view (viewer, timestamp, IP)
- [ ] **REPL-06**: Content filtering at renderer level — share-link API returns Clean-mode projection only (server-side, not client-side hiding)

### Mobile & PWA

- [ ] **MOBI-01**: Responsive layout works on mobile browsers (Tailwind responsive)
- [ ] **MOBI-02**: PWA manifest + service worker for installable app shell
- [ ] **MOBI-03**: Push notifications for question-queue items and plan-approval requests
- [ ] **MOBI-04**: Mobile question queue view — answer agent questions from phone
- [ ] **MOBI-05**: Overnight digest view — summary of what happened while user was away

### Operator & Sentinel

- [ ] **OPER-01**: Tenant provisioning via admin script (create tenant schema, seed config, invite first user)
- [ ] **OPER-02**: Operator console web UI — system health, running agents, active runs, cost overview
- [ ] **OPER-03**: Sentinel Phase A — passive logging of agent behavior (drift scores, quality signals)
- [ ] **OPER-04**: Sentinel pane visible in Studio mode for operator-role users
- [ ] **OPER-05**: Break-glass flow — operator can access tenant conversation content with time-boxed authorization
- [ ] **OPER-06**: Customer-visible audit log — tenant admin sees when operator accessed their data

### Infrastructure & Deployment

- [ ] **INFR-01**: Docker Compose deployment on BeagleHQ VPS (three containers: web, agent-hub, worker)
- [ ] **INFR-02**: Caddy reverse proxy config for console.beaglemind.ai with auto-TLS
- [ ] **INFR-03**: Docker memory limits on all containers (VPS has ~5GB available for console)
- [ ] **INFR-04**: CI/CD pipeline (GitHub Actions → deploy to BeagleHQ)
- [x] **INFR-05**: Monorepo structure: apps/web, apps/agent-hub, apps/worker, packages/db, packages/shared
- [x] **INFR-06**: Per-tenant Obsidian vault wiring (agents read/write through tenant-aware path resolver)

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
| WORK-01 | Phase 4 | Pending |
| WORK-02 | Phase 4 | Pending |
| WORK-03 | Phase 4 | Pending |
| WORK-04 | Phase 4 | Pending |
| WORK-05 | Phase 4 | Pending |
| WORK-06 | Phase 4 | Pending |
| WORK-07 | Phase 4 | Pending |
| WORK-08 | Phase 4 | Pending |
| WORK-09 | Phase 4 | Pending |
| TRAN-01 | Phase 5 | Pending |
| TRAN-02 | Phase 5 | Pending |
| TRAN-03 | Phase 5 | Pending |
| TRAN-04 | Phase 5 | Pending |
| TRAN-05 | Phase 5 | Pending |
| TRAN-06 | Phase 5 | Pending |
| TRAN-07 | Phase 5 | Pending |
| MODE-01 | Phase 6 | Pending |
| MODE-02 | Phase 6 | Pending |
| MODE-03 | Phase 6 | Pending |
| MODE-04 | Phase 6 | Pending |
| MODE-05 | Phase 6 | Pending |
| MODE-06 | Phase 6 | Pending |
| ARTF-01 | Phase 7 | Pending |
| ARTF-02 | Phase 7 | Pending |
| ARTF-03 | Phase 7 | Pending |
| ARTF-04 | Phase 7 | Pending |
| ARTF-05 | Phase 7 | Pending |
| REPL-01 | Phase 8 | Pending |
| REPL-02 | Phase 8 | Pending |
| REPL-03 | Phase 8 | Pending |
| REPL-04 | Phase 8 | Pending |
| REPL-05 | Phase 8 | Pending |
| REPL-06 | Phase 8 | Pending |
| MOBI-01 | Phase 10 | Pending |
| MOBI-02 | Phase 10 | Pending |
| MOBI-03 | Phase 10 | Pending |
| MOBI-04 | Phase 10 | Pending |
| MOBI-05 | Phase 10 | Pending |
| OPER-01 | Phase 9 | Pending |
| OPER-02 | Phase 9 | Pending |
| OPER-03 | Phase 9 | Pending |
| OPER-04 | Phase 9 | Pending |
| OPER-05 | Phase 9 | Pending |
| OPER-06 | Phase 9 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 1 | Pending |
| INFR-05 | Phase 1 | Complete |
| INFR-06 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 64 total
- Mapped to phases: 64
- Unmapped: 0

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after roadmap creation*
