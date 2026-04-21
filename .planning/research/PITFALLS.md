# Domain Pitfalls

**Domain:** Multi-agent AI console / observable reasoning system
**Researched:** 2026-04-21

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Connection Pool Exhaustion with Per-Tenant Schemas

**What goes wrong:** Creating a new Postgres connection pool per tenant per request. On 8GB RAM VPS with existing services consuming ~3GB, you run out of connections fast. PostgreSQL default max_connections is 100.
**Why it happens:** Naive implementation of schema isolation creates a pool per `getTenantDb()` call.
**Consequences:** Database refuses connections, all tenants go down simultaneously, cascading failures across console-web, agent-hub, and worker.
**Prevention:** Single shared connection pool (20-30 connections). Use Drizzle's `pgSchema()` for query scoping -- it doesn't need separate pools. Alternatively, use `SET search_path TO tenant_xxx` at transaction start. Monitor with `pg_stat_activity`.
**Detection:** Watch for "too many connections" errors in logs. Set up Prometheus alert on connection count > 80% of max_connections.

### Pitfall 2: Tenant Data Leakage

**What goes wrong:** A bug in tenant context resolution lets User A see User B's runs/messages.
**Why it happens:** Missing middleware, race condition in async context, or a single API route that forgets to scope by tenant.
**Consequences:** Catastrophic for enterprise SaaS. Finance firms handling proprietary research data will leave permanently.
**Prevention:** Tenant scoping in middleware layer, not in individual route handlers. Every database query goes through `getTenantDb(tenantId)` which returns schema-bound tables. No query can escape tenant scope because the table references are schema-qualified. Add integration tests that verify cross-tenant isolation: create data in tenant_a, assert it is invisible from tenant_b.
**Detection:** Audit log every tenant context switch. Integration test suite that runs on every deploy.

### Pitfall 3: SSE Connection Limits

**What goes wrong:** Browser has a hard limit of 6 concurrent HTTP/1.1 connections per domain. Each open SSE stream consumes one. With multiple runs or tabs, you run out.
**Why it happens:** SSE uses long-lived HTTP connections. HTTP/1.1 browsers enforce the limit.
**Consequences:** New SSE streams fail silently. UI appears frozen, no agent messages arrive.
**Prevention:** Use HTTP/2 (Caddy does this by default with HTTPS -- verify). HTTP/2 multiplexes streams over a single connection, effectively removing the 6-connection limit. Also: only open one SSE per active run, close when navigating away. Implement reconnect logic with exponential backoff.
**Detection:** Monitor active SSE connections in Next.js. Log when connection is refused or times out.

### Pitfall 4: Redis as Single Point of Failure

**What goes wrong:** Redis crash takes down real-time streaming (pub/sub), job queue (BullMQ), and session cache simultaneously.
**Why it happens:** Redis does triple duty in this architecture. Single instance, no replication.
**Consequences:** Total system outage. No agent messages, no background jobs, potentially broken auth sessions.
**Prevention:** For Product Proof / Company Proof: accept this risk, ensure Redis persistence (RDB + AOF), monitor with Prometheus. For Scale: add Redis Sentinel or switch to Dragonfly. Keep database sessions in Postgres (not Redis) so auth survives Redis outage.
**Detection:** Redis health check in Docker Compose. BullMQ has built-in stalled job detection. Prometheus redis_up metric.

### Pitfall 5: Agent Hub Message Ordering

**What goes wrong:** Messages from multiple agents arrive out of order in the transcript. Scene boundaries break. User sees reply before the message it replies to.
**Why it happens:** WebSocket messages from different agents are independent. Redis pub/sub doesn't guarantee cross-channel ordering. Network latency varies.
**Consequences:** Confusing transcript. Users lose trust in the reasoning display.
**Prevention:** Server-side message sequencing. Agent Hub assigns monotonically increasing sequence numbers before publishing to Redis. Browser-side Zustand store inserts by sequence number, not arrival order. Use `Date.now()` + per-hub counter for ordering.
**Detection:** Browser-side assertion: every new message's sequence > previous. Log violations.

## Moderate Pitfalls

### Pitfall 1: Drizzle v1 Migration Trap

**What goes wrong:** Starting on 0.45.x, then Drizzle v1.0 GA releases with breaking schema API changes mid-project.
**Prevention:** Pin to 0.45.x. Do not chase beta. Schema factory pattern (`createTenantSchema`) isolates Drizzle API surface -- if v1 changes pgSchema, you update one function. Monitor Drizzle release notes monthly.

### Pitfall 2: Better Auth Organization Plugin Immaturity

**What goes wrong:** Organization plugin edge cases (multi-org users, org switching, invitation flows) have bugs or missing features.
**Prevention:** Better Auth is at v1.6.x and actively maintained. The Organization plugin is a core feature, not experimental. But: write integration tests for your specific flows (invite -> accept -> org switch -> tenant scoping). Keep Better Auth pinned to minor version. Test upgrades in staging.

### Pitfall 3: MinIO Disk Space on Shared VPS

**What goes wrong:** Agent-generated artifacts fill up the 150GB disk shared with Postgres, Grafana, Prometheus, and the OS.
**Prevention:** Set MinIO bucket lifecycle policies (auto-delete artifacts older than 90 days for non-premium tenants). Monitor disk usage with Prometheus node_exporter. Alert at 80% capacity. Budget: Postgres ~10GB, Grafana/Prometheus ~20GB, OS ~10GB, leaves ~110GB for MinIO and growth.

### Pitfall 4: Docker Networking with Host Services

**What goes wrong:** Containers can't reach host-level Postgres and Redis. `localhost` inside a container refers to the container, not the host.
**Prevention:** Use `host.docker.internal` (Docker Desktop) or `network_mode: host` or explicit Docker network with host IP. On Linux (Hetzner VPS), use `extra_hosts: ["host.docker.internal:host-gateway"]` in docker-compose.yml. Test connectivity before deploying app code.

### Pitfall 5: SSE Through Caddy Buffering

**What goes wrong:** Caddy buffers SSE responses, causing messages to arrive in batches instead of streaming.
**Prevention:** Caddy v2 streams responses by default for `text/event-stream` content type. Verify with `curl -N` that events arrive one-by-one. If buffering occurs, add `flush_interval -1` to the reverse_proxy directive in Caddyfile.

### Pitfall 6: Zustand Store Memory Leaks for Long Runs

**What goes wrong:** A run with 10,000+ messages keeps all of them in the Zustand store. Browser memory grows unbounded.
**Prevention:** Implement a windowed message store. Keep last N messages (e.g., 500) in memory, older messages fetched on scroll-up via API. react-virtuoso handles the rendering side; the store needs eviction logic.

## Minor Pitfalls

### Pitfall 1: Next.js Standalone Output Missing Files

**What goes wrong:** `output: 'standalone'` in next.config doesn't copy public/ or .next/static by default.
**Prevention:** Dockerfile must explicitly copy these directories into the standalone output. Follow the official Next.js Docker example.

### Pitfall 2: shadcn/ui Component Version Drift

**What goes wrong:** shadcn components are copy-pasted, not dependency-managed. Updates require manual diffing.
**Prevention:** Accept this tradeoff -- it's the shadcn model. Keep a `components.json` tracking which shadcn components are installed. Update quarterly, not per-release.

### Pitfall 3: BullMQ Job Serialization

**What goes wrong:** Job data must be JSON-serializable. Passing Date objects, Maps, or circular references silently fails.
**Prevention:** Use zod schemas for job payloads. Validate before enqueue. Keep payloads small -- store large data in Postgres/MinIO, pass IDs in job.

### Pitfall 4: Timezone Confusion in Timestamps

**What goes wrong:** Postgres stores timestamps in UTC. Browser displays in local time. Agent messages have their own timestamp source.
**Prevention:** All timestamps in UTC at storage layer. Use `timestamptz` column type in Drizzle. Format with date-fns + user's timezone preference on display. Agent Hub normalizes all agent timestamps to UTC before persistence.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth + tenant setup | Connection pool per tenant | Single pool + schema scoping from day 1 |
| Agent Hub integration | Message ordering across agents | Sequence numbering at Agent Hub level |
| Transcript UI | SSE connection limits | Verify HTTP/2 via Caddy, single SSE per run |
| Transcript UI | Memory for long runs | Windowed store + react-virtuoso |
| Docker deployment | Container-to-host networking | Test `host.docker.internal` on Hetzner Linux |
| Replay share-links | Tenant data leakage in shared links | Content filtering at renderer level, not query level |
| PWA push notifications | Service worker caching stale UI | Serwist cache-first for shell, network-first for API |
| Scaling beyond 50 users | Redis SPOF | Redis Sentinel or Dragonfly when crossing threshold |

## Sources

- [Drizzle multi-tenant discussion](https://github.com/drizzle-team/drizzle-orm/discussions/3199) - community-reported issues with schema isolation
- [Next.js SSE in App Router](https://github.com/vercel/next.js/discussions/48427) - known SSE issues and workarounds
- [BullMQ best practices](https://docs.bullmq.io/) - job serialization and retry patterns
- [Docker host networking on Linux](https://community.hetzner.com/tutorials/deploy-nodejs-with-docker/) - Hetzner-specific Docker guidance
- [Caddy reverse proxy docs](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) - streaming and flush behavior
