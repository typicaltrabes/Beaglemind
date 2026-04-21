# Beagle Agent Console

## What This Is

A web-based observable reasoning system and governed workbench for the BeagleMind multi-agent fleet. Multiple AI agents (Mo, Jarvis, Sam, and others) think out loud, push back on each other, reach conclusions visibly, and produce a record you can replay. Users watch the reasoning, steer it at key moments (plan approval, question queue, red-team), and take delivery of governed artifacts. Replaces the current WhatsApp-based coordination with a structured, scalable, sellable interface.

## Core Value

Users can observe multi-agent reasoning in real time, steer it at governance gates (plan approval, questions, red-team), and share the full replay externally — making the quality of thinking visible and auditable.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Authentication with Better Auth + MFA
- [ ] Multi-tenant architecture with per-tenant schema isolation enforced at ORM/middleware from commit 1
- [ ] Research sprint workflow end-to-end: user prompt → Mo plan → approval → worker execution → artifact delivery
- [ ] Plan-approval gate with cost estimate (no API spend without human approval)
- [ ] Question queue (agents queue clarifications instead of self-authorizing)
- [ ] Writers' Room transcript with scene auto-naming, scene-collapse, live TLDR banner
- [ ] Clean mode (default) and Studio mode (toggle) — no role-gating in Year 1
- [ ] Agent Connection Hub (Node WebSocket service connecting to OpenClaw agents)
- [ ] OpenClaw "console channel" plugin for Mo
- [ ] Process drawer (Studio mode) with sentinel data, cost, fork/branch info
- [ ] @-mention, verbosity dial, Interrupt agent, fork button (Studio only)
- [ ] Single Stop button in Clean mode composer
- [ ] Timeline view — scrubbable horizontal replay of a run
- [ ] Replay share-links: tokenized, scoped to Clean-mode content, revocable, time-boxed, audit-logged
- [ ] Red-team button on completed runs (spawns new Run with kind=red_team_pass)
- [ ] Three-mechanism disagreement system: organic pushback, Mo auto-invoked counterpoint, user-triggered red-team
- [ ] Mobile PWA with question queue + overnight digest
- [ ] Push notifications for question-queue and plan-approvals
- [ ] Per-tenant Obsidian vault wiring (agents read/write through tenant-aware path resolver)
- [ ] Sentinel Phase A (passive logging)
- [ ] Sentinel Phase B (rule-based flags)
- [ ] Sentinel Phase C (baseline scoring)
- [ ] Sentinel pane in Studio (operator-only)
- [ ] Boardroom view — parallel agent columns
- [ ] Canvas view — artifact-first doc surface with margin agent comments
- [ ] Tenant provisioning (admin script, then UI)
- [ ] Operator console with metadata + system health + sentinel output
- [ ] Operator break-glass with customer-visible audit
- [ ] Replay renderer service (tokenized share-link target with scoping filter)
- [ ] SSO integration
- [ ] Billing system (per-seat / per-project / per-agent-month — model TBD)
- [ ] Per-tenant cost ceiling + model fallback alarm
- [ ] File attachment handling, inline docx/pdf preview
- [ ] Artifact versioning and export
- [ ] CI/CD pipeline
- [ ] Dedicated-VPS tier for enterprise customers

### Out of Scope

- Additional workflows beyond research sprint (red-team is a Run.kind variant, not a new workflow) — singular focus until Product Proof gate passes
- Role-gated UI (Clean-only users, Studio-only users) — all Year-1 users get both modes
- White-label, customer-defined agent personas, skill marketplace — premature customization
- Native mobile app — PWA only through CP2
- Freeform chat with Mo outside research-sprint classification — unstructured interaction defeats governance
- Real-time multi-user collaboration in the same project — complexity vs value doesn't justify for v1
- Multi-region HA — single-region Hetzner sufficient for Year 1 user base
- Third-party integrations (Slack, email-to-project) — focus on core loop first
- Design refresh beyond shadcn defaults — real designer engagement during CP1 or CP2
- Consumer market, free tier, high-volume/low-value use cases — enterprise-only positioning

## Context

**Existing infrastructure:** Two Hetzner VPS boxes — BeagleHQ (46.224.167.166) runs Caddy, LiteLLM, Grafana, Prometheus, PostgreSQL 17.4, Redis; Agents VPS (46.225.56.122) runs Mo, Sam, Herman via OpenClaw v2026.3.2. Console deploys to BeagleHQ alongside existing stack using the existing Postgres instance (new database). Domain: console.beaglemind.ai via Caddy.

**Current agent fleet:** Mo (workflow lead, Henrik manages), Jarvis (research analyst, Lucas manages, runs on separate droplet), Sam (QA sentinel, observes Mo), Herman (open-weight model testbed). Formatting Agent, PM Agent, Junior Analyst planned but not yet built.

**Memory architecture:** Three-layer system — shared factual knowledge base, agent-private memory (siloed), curated crossover mediated by Sam. Infrastructure is Obsidian vaults on Dropbox.

**WhatsApp problem:** Current coordination via WhatsApp group chat is noisy, has no structure, no approval gates, no question queue, no handoff to outsiders, and is not sellable. Cost hit $1K/3 days before PM orchestration model was designed.

**Team:** Lucas Traber (Hanseatic, NYC — manages Jarvis, drives product/tech) and Henrik (manages Mo, owns sentinel + agent training). Two-person team building for eventual sale to boutique investment and research firms.

**Code repo:** GitHub under BeagleMind org. Developed directly on BeagleHQ server.

## Constraints

- **Tech stack**: Next.js, Tailwind, shadcn/ui, Better Auth, PostgreSQL (Drizzle ORM), Node WebSocket, Caddy, BullMQ, MinIO — per design doc v3 §12
- **Infrastructure**: Hetzner co-location on BeagleHQ VPS (150GB disk, 8GB RAM, existing stack consuming ~3GB)
- **Tenant isolation**: Shared code + per-tenant schema + per-tenant vault from commit 1 — infrastructure-level isolation, not permission-level
- **Agent compatibility**: Must integrate with OpenClaw v2026.3.2 via console channel plugin
- **Privacy**: Replay shares show Clean-mode content only. No sentinel annotations, no drawer, no Studio signals leak externally
- **Cost**: LiteLLM routes all model calls; per-agent API keys with budget limits already in place
- **Product Proof gate**: Two consecutive weeks of internal daily-drive meeting 6 pre-conditions (§2) before any Company Proof work

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Observable reasoning as headline, governed workbench as sales frame | Hidden agent dialogue is indistinguishable from any chat product; visible dialogue creates a new category | — Pending |
| Clean mode default, Studio toggle, no role-gating Year 1 | Every Year-1 user is power-capable; role-gated simplicity is Year-2+ | — Pending |
| Single research sprint workflow for v1 | Focus beats breadth; red-team is a Run.kind variant, not a second workflow | — Pending |
| Develop directly on BeagleHQ server | Faster iteration, no local Docker setup, direct access to existing Postgres/Caddy/agents | — Pending |
| Existing Postgres instance (new database) | Simpler infra, shares beaglehq-postgres-1; tenant isolation via schema, not container | — Pending |
| console.beaglemind.ai domain | Matches wireframe URLs, clean subdomain under existing Caddy | — Pending |
| GitHub under BeagleMind org | Shared team access, Henrik can contribute | — Pending |
| PWA from day one, no native app | Lower build cost, sufficient for question-queue + digest mobile use case | — Pending |
| Three-mechanism disagreement system | Organic training + Mo auto-invoke + user red-team covers both reliable and on-demand dialectic | — Pending |
| Replay share-link as PP3 deliverable | Marketing flywheel — pilot customer shares investigation, colleague watches agents think | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-21 after initialization*
