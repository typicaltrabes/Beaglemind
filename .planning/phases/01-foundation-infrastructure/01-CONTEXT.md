# Phase 1: Foundation & Infrastructure - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a deployable project skeleton on BeagleHQ VPS: monorepo with three apps (web, agent-hub, worker), Docker Compose deployment alongside the existing BeagleHQ stack, Caddy reverse proxy for console.beaglemind.ai, CI/CD pipeline from GitHub, PostgreSQL database with tenant schema structure, MinIO for artifact storage, and vault path resolver for Obsidian integration.

This phase delivers infrastructure only — no auth, no UI, no agent connectivity. Success = `docker compose up` works on BeagleHQ, Caddy serves a page at console.beaglemind.ai, and CI/CD deploys on push.

</domain>

<decisions>
## Implementation Decisions

### Monorepo Structure
- **D-01:** Use pnpm workspaces as the package manager and monorepo tool. No Turborepo or Nx — pnpm's native workspace support is sufficient for 3 apps + 2 packages.
- **D-02:** Structure: `apps/web` (Next.js 15.5), `apps/agent-hub` (Node/ws service), `apps/worker` (BullMQ processors), `packages/db` (Drizzle schema + tenant utilities), `packages/shared` (Zod-validated types).
- **D-03:** TypeScript 5.7+ across all packages. Strict mode enabled.

### Docker Deployment
- **D-04:** Console gets its own `docker-compose.yml` at `/opt/beagle-console/` on BeagleHQ. Does NOT modify the existing `/opt/beaglehq/` compose files.
- **D-05:** Console containers join existing BeagleHQ networks via `external: true` — connects to `beaglehq_backend` for Postgres/Redis access and `beaglehq_frontend` for Caddy routing.
- **D-06:** Base image: `node:22-slim` for all three containers. Multi-stage Dockerfile per app — build stage with devDependencies, production stage with standalone output only.
- **D-07:** Memory limits on all containers: web ~512MB, agent-hub ~256MB, worker ~256MB. Total ~1GB, leaving headroom on the 8GB VPS.
- **D-08:** MinIO container added to the console compose stack with bucket-per-tenant isolation. Persistent volume for artifact data.

### Database Schema
- **D-09:** Create a new database `beagle_console` in the existing `beaglehq-postgres-1` container. Separate database from LiteLLM/Grafana data.
- **D-10:** Tenant schema naming: `tenant_{uuid}` schemas. A `shared` schema holds auth tables (Better Auth), system config, and tenant registry.
- **D-11:** Single shared connection pool (20-30 connections) with `SET search_path` per request. No pool-per-tenant (would OOM the VPS per research PITFALLS.md).
- **D-12:** Custom migration runner (~100 lines) that iterates tenant schemas and applies Drizzle migrations. `drizzle-kit` used for schema generation but not for multi-tenant migration execution.
- **D-13:** Tenant provisioning script: creates tenant record in shared schema, creates `tenant_{uuid}` PostgreSQL schema, runs migrations on new schema, creates MinIO bucket.

### CI/CD Pipeline
- **D-14:** GitHub Actions workflow: push to `main` → build Docker images → push to GHCR → SSH to BeagleHQ → `docker compose pull && docker compose up -d`.
- **D-15:** Multi-stage Dockerfiles with Next.js standalone output for web app. No node_modules in production images.
- **D-16:** GitHub repo under BeagleMind org. Branch protection on main with required CI pass.

### Caddy Configuration
- **D-17:** Add `console.beaglemind.ai` block to the existing BeagleHQ Caddyfile. Route to the web container. WebSocket upgrade support for future agent-hub connections.
- **D-18:** DNS A record for console.beaglemind.ai → 46.224.167.166 (BeagleHQ IP). Managed at STRATO.

### Vault Wiring
- **D-19:** Tenant-aware vault path resolver: maps `tenant_id` → Obsidian vault directory path. For v1, vaults are on the BeagleHQ filesystem (Dropbox-synced). Resolver is a utility in `packages/db`.

### Claude's Discretion
- Exact pnpm workspace configuration and tsconfig setup
- Dockerfile optimization details (layer caching, .dockerignore)
- GitHub Actions workflow YAML specifics
- Drizzle schema table definitions (beyond the multi-tenant structure)
- MinIO configuration details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Document
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260417 Beagle Agent Console — Design Doc v3.md` — Full product design, §9 tenancy discipline, §12 system architecture, §14 build sequence

### Research
- `.planning/research/STACK.md` — Technology versions, library recommendations, install commands
- `.planning/research/ARCHITECTURE.md` — Three-service split, monorepo structure, data flow patterns
- `.planning/research/PITFALLS.md` — Critical: connection pool exhaustion, tenant leakage, Docker memory limits
- `.planning/research/SUMMARY.md` — Synthesized recommendations and build order

### Existing Infrastructure
- BeagleHQ compose: `/opt/beaglehq/compose.yaml` and `/opt/beaglehq/compose.prod.yaml` (via SSH — read to understand network/volume naming)
- BeagleHQ Caddyfile: `/opt/beaglehq/caddy/Caddyfile` (via SSH — read before adding console.beaglemind.ai block)
- BeagleHQ env: `/opt/beaglehq/.env` (via SSH — Postgres credentials for creating new database)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code.

### Established Patterns
- BeagleHQ uses Docker Compose with named volumes, external networks (beaglehq_backend, beaglehq_frontend), and Caddy for reverse proxy + auto-TLS.
- Existing Postgres has `beaglehq` database. Console uses a new `beagle_console` database in the same instance.
- Redis already running on beaglehq_backend network — console containers can connect directly.

### Integration Points
- Console web container → Caddy (beaglehq_frontend network) → console.beaglemind.ai
- Console containers → Postgres (beaglehq_backend network) → beagle_console database
- Console containers → Redis (beaglehq_backend network) → pub/sub + BullMQ + cache
- Future: Agent Hub → Agents VPS (46.225.56.122) via WebSocket (Phase 3)

</code_context>

<specifics>
## Specific Ideas

- The dark theme from wireframes (CSS variables: --bg: #0f1115, --panel: #161922, --accent: #f7b733 beagle gold, --accent-2: #4db6ac jarvis teal, --accent-3: #c86bff sentinel purple, --user: #6ea8fe) should be set up in Tailwind config from the start.
- The initial page at console.beaglemind.ai can be a simple "Beagle Agent Console" placeholder with the dark theme — proves Caddy + Docker + TLS work end-to-end.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-04-21*
