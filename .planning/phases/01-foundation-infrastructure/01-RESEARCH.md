# Phase 1: Foundation & Infrastructure - Research

**Researched:** 2026-04-21
**Domain:** Monorepo scaffold, Docker deployment, database multi-tenancy, CI/CD, reverse proxy
**Confidence:** HIGH

## Summary

This phase delivers the deployable skeleton for Beagle Agent Console on the existing BeagleHQ VPS. The core technical challenges are: (1) setting up a pnpm monorepo with three apps and two shared packages, (2) Docker Compose deployment that joins the existing BeagleHQ network stack without modifying it, (3) multi-tenant PostgreSQL schema isolation with Drizzle ORM's `pgSchema()`, (4) GitHub Actions CI/CD pipeline pushing to GHCR and deploying via SSH, (5) Caddy reverse proxy for console.beaglemind.ai, and (6) MinIO for artifact storage with bucket-per-tenant.

All technologies are well-documented and stable. The riskiest area is the custom Drizzle migration runner for multi-tenant schemas -- Drizzle's built-in `migrate()` function does not natively iterate over multiple schemas, so a ~100-line custom runner is needed. Everything else follows standard, well-trodden patterns.

**Primary recommendation:** Build the monorepo scaffold first, then Docker Compose with networking, then database schema, then CI/CD, then Caddy + MinIO. Each layer depends on the previous one being verifiable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** pnpm workspaces as monorepo tool. No Turborepo or Nx.
- **D-02:** Structure: `apps/web` (Next.js 15.5), `apps/agent-hub` (Node/ws service), `apps/worker` (BullMQ processors), `packages/db` (Drizzle schema + tenant utilities), `packages/shared` (Zod-validated types).
- **D-03:** TypeScript 5.7+ across all packages. Strict mode enabled.
- **D-04:** Console gets its own `docker-compose.yml` at `/opt/beagle-console/` on BeagleHQ. Does NOT modify existing `/opt/beaglehq/` compose files.
- **D-05:** Console containers join existing BeagleHQ networks via `external: true` -- connects to `beaglehq_backend` for Postgres/Redis access and `beaglehq_frontend` for Caddy routing.
- **D-06:** Base image: `node:22-slim` for all three containers. Multi-stage Dockerfile per app.
- **D-07:** Memory limits: web ~512MB, agent-hub ~256MB, worker ~256MB.
- **D-08:** MinIO container in console compose stack with bucket-per-tenant isolation.
- **D-09:** New database `beagle_console` in existing `beaglehq-postgres-1` container.
- **D-10:** Tenant schema naming: `tenant_{uuid}` schemas. `shared` schema for auth/system/tenant registry.
- **D-11:** Single shared connection pool (20-30 connections) with `SET search_path` per request.
- **D-12:** Custom migration runner that iterates tenant schemas and applies Drizzle migrations.
- **D-13:** Tenant provisioning script: create tenant record, create PG schema, run migrations, create MinIO bucket.
- **D-14:** GitHub Actions: push to main -> build Docker images -> push to GHCR -> SSH to BeagleHQ -> docker compose pull && up -d.
- **D-15:** Multi-stage Dockerfiles with Next.js standalone output.
- **D-16:** GitHub repo under BeagleMind org. Branch protection on main.
- **D-17:** Add `console.beaglemind.ai` block to existing BeagleHQ Caddyfile. WebSocket upgrade support.
- **D-18:** DNS A record for console.beaglemind.ai -> 46.224.167.166 at STRATO.
- **D-19:** Tenant-aware vault path resolver in `packages/db`.

### Claude's Discretion
- Exact pnpm workspace configuration and tsconfig setup
- Dockerfile optimization details (layer caching, .dockerignore)
- GitHub Actions workflow YAML specifics
- Drizzle schema table definitions (beyond multi-tenant structure)
- MinIO configuration details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Docker Compose deployment on BeagleHQ VPS (three containers: web, agent-hub, worker) | Docker Compose with external networks, multi-stage Dockerfiles, memory limits |
| INFR-02 | Caddy reverse proxy config for console.beaglemind.ai with auto-TLS | Caddyfile block with reverse_proxy, flush_interval for SSE, WebSocket upgrade |
| INFR-03 | Docker memory limits on all containers (VPS has ~5GB available for console) | deploy.resources.limits in docker-compose.yml |
| INFR-04 | CI/CD pipeline (GitHub Actions -> deploy to BeagleHQ) | GHCR build/push, SSH deploy action, secrets configuration |
| INFR-05 | Monorepo structure: apps/web, apps/agent-hub, apps/worker, packages/db, packages/shared | pnpm workspaces, shared tsconfig, workspace:* dependencies |
| INFR-06 | Per-tenant Obsidian vault wiring (agents read/write through tenant-aware path resolver) | Vault path resolver utility in packages/db |
</phase_requirements>

## Standard Stack

### Core (Phase 1 only -- what gets installed now)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.15 | Web app framework | Latest 15.5.x patch. Decision is 15.5, not 16. Standalone output for Docker. [VERIFIED: npm registry -- 15.5.15 is latest 15.5.x] |
| React | 19.1.0 | UI library | Paired with Next.js 15.5. [VERIFIED: npm registry] |
| TypeScript | 5.7.3 | Type safety | Decision D-03 requires 5.7+. Latest 5.7.x is 5.7.3. Current latest is 6.0.3 but 5.7 is locked. [VERIFIED: npm registry] |
| Drizzle ORM | 0.45.2 | Type-safe ORM | pgSchema() for multi-tenant. Pinned to 0.45.x, not 1.0 beta. [VERIFIED: npm registry] |
| drizzle-kit | 0.31.10 | Migration CLI | Schema generation and SQL migration files. [VERIFIED: npm registry] |
| ws | 8.20.0 | WebSocket server | Agent hub service. [VERIFIED: npm registry] |
| BullMQ | 5.75.2 | Job queue | Worker service. Redis-backed. [VERIFIED: npm registry] |
| zod | 4.3.6 | Schema validation | Shared types package. [VERIFIED: npm registry -- note: zod 4.x is now latest] |
| @aws-sdk/client-s3 | 3.1033.0 | MinIO S3 client | MinIO uses S3 API. [VERIFIED: npm registry] |
| Tailwind CSS | 4.x | Styling | CSS-first config, zero-runtime. [ASSUMED -- 4.x is stable per STACK.md] |

### Dev Tooling

| Library | Version | Purpose |
|---------|---------|---------|
| @biomejs/biome | 2.4.12 | Linting + formatting [VERIFIED: npm registry] |
| vitest | 4.1.5 | Unit testing [VERIFIED: npm registry] |
| pnpm | 10.33.0 | Package manager [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pnpm workspaces | Turborepo | Decision D-01 locks pnpm-only. Turborepo adds build caching but overkill for 3 apps. |
| Custom migration runner | drizzle-multitenant | Community toolkit (v1.3.5, 2 stars). Too immature. ~100 lines of custom code is simpler. |
| node:22-slim | node:22-alpine | Slim is larger (~200MB vs ~130MB) but avoids musl libc issues with native dependencies. Decision D-06 locks slim. |

**Installation (Phase 1 foundation packages):**
```bash
# In monorepo root
pnpm add -w typescript@5.7.3
pnpm add -Dw @biomejs/biome@latest vitest@latest drizzle-kit@latest

# apps/web
pnpm add next@15.5.15 react@19 react-dom@19 --filter @beagle-console/web

# apps/agent-hub
pnpm add ws --filter @beagle-console/agent-hub
pnpm add -D @types/ws --filter @beagle-console/agent-hub

# apps/worker
pnpm add bullmq --filter @beagle-console/worker

# packages/db
pnpm add drizzle-orm@0.45.2 postgres --filter @beagle-console/db

# packages/shared
pnpm add zod --filter @beagle-console/shared
```

## Architecture Patterns

### Recommended Project Structure

```
beagle-console/
  pnpm-workspace.yaml
  package.json                 # Root: scripts, devDependencies
  tsconfig.base.json           # Shared TS config, extended by each package
  biome.json                   # Root biome config
  .dockerignore
  .github/
    workflows/
      deploy.yml               # CI/CD pipeline
  docker/
    docker-compose.yml         # Deployed to /opt/beagle-console/
    docker-compose.dev.yml     # Local dev overrides (optional)
  apps/
    web/
      Dockerfile
      next.config.ts
      tsconfig.json            # extends ../../tsconfig.base.json
      package.json             # name: @beagle-console/web
      app/                     # App Router
        layout.tsx
        page.tsx               # Placeholder page
        api/                   # Route handlers (future)
      tailwind.config.ts
    agent-hub/
      Dockerfile
      tsconfig.json
      package.json             # name: @beagle-console/agent-hub
      src/
        index.ts               # Entry point
        server.ts              # WebSocket server setup
    worker/
      Dockerfile
      tsconfig.json
      package.json             # name: @beagle-console/worker
      src/
        index.ts               # Entry point
        queues/                 # Queue definitions
  packages/
    db/
      tsconfig.json
      package.json             # name: @beagle-console/db
      src/
        index.ts               # Public API
        client.ts              # Drizzle client, connection pool
        schema/
          shared.ts            # shared schema tables (tenants, auth)
          tenant.ts            # createTenantSchema() factory
        migrations/
          *.sql                # Generated by drizzle-kit
        migrate.ts             # Custom multi-tenant migration runner
        vault-resolver.ts      # Tenant -> vault path mapping
    shared/
      tsconfig.json
      package.json             # name: @beagle-console/shared
      src/
        index.ts               # Public API
        types/                 # Zod schemas + inferred types
```

### Pattern 1: pnpm Workspace Configuration

**What:** Root-level workspace config that links all packages.
**Source:** [VERIFIED: pnpm.io/workspaces]

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// Root package.json
{
  "name": "beagle-console",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter @beagle-console/web dev",
    "dev:hub": "pnpm --filter @beagle-console/agent-hub dev",
    "dev:worker": "pnpm --filter @beagle-console/worker dev",
    "build": "pnpm -r build",
    "lint": "biome check .",
    "format": "biome format --write .",
    "db:generate": "pnpm --filter @beagle-console/db generate",
    "db:migrate": "pnpm --filter @beagle-console/db migrate"
  },
  "devDependencies": {
    "typescript": "5.7.3",
    "@biomejs/biome": "latest",
    "vitest": "latest"
  }
}
```

```json
// apps/web/package.json (example workspace package)
{
  "name": "@beagle-console/web",
  "private": true,
  "dependencies": {
    "@beagle-console/db": "workspace:*",
    "@beagle-console/shared": "workspace:*",
    "next": "15.5.15",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### Pattern 2: Shared TypeScript Configuration

**What:** Base tsconfig extended by each package for consistency.
**Source:** [CITED: medium.com/@mernstackdevbykevin - monorepo TS config patterns]

```json
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true
  }
}
```

```json
// packages/db/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Pattern 3: Docker Compose with External Networks

**What:** Console stack joins existing BeagleHQ networks without modifying the BeagleHQ compose files.
**Source:** [VERIFIED: docs.docker.com/compose/how-tos/networking]

```yaml
# docker/docker-compose.yml (deployed to /opt/beagle-console/)
services:
  console-web:
    image: ghcr.io/beaglemind/console-web:latest
    restart: unless-stopped
    networks:
      - beaglehq_backend
      - beaglehq_frontend
    environment:
      - DATABASE_URL=postgresql://user:pass@beaglehq-postgres-1:5432/beagle_console
      - REDIS_URL=redis://beaglehq-redis-1:6379
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
    deploy:
      resources:
        limits:
          memory: 512M

  console-agent-hub:
    image: ghcr.io/beaglemind/console-agent-hub:latest
    restart: unless-stopped
    networks:
      - beaglehq_backend
    environment:
      - DATABASE_URL=postgresql://user:pass@beaglehq-postgres-1:5432/beagle_console
      - REDIS_URL=redis://beaglehq-redis-1:6379
    deploy:
      resources:
        limits:
          memory: 256M

  console-worker:
    image: ghcr.io/beaglemind/console-worker:latest
    restart: unless-stopped
    networks:
      - beaglehq_backend
    environment:
      - DATABASE_URL=postgresql://user:pass@beaglehq-postgres-1:5432/beagle_console
      - REDIS_URL=redis://beaglehq-redis-1:6379
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
    deploy:
      resources:
        limits:
          memory: 256M

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    restart: unless-stopped
    networks:
      - beaglehq_backend
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
    deploy:
      resources:
        limits:
          memory: 256M

networks:
  beaglehq_backend:
    external: true
  beaglehq_frontend:
    external: true

volumes:
  minio_data:
```

**Critical detail:** Container hostnames in the external network use the full container name from the BeagleHQ stack (e.g., `beaglehq-postgres-1`, `beaglehq-redis-1`). These names MUST be verified by SSH-ing into BeagleHQ and running `docker ps` to confirm exact container names. [ASSUMED -- exact names need verification on server]

### Pattern 4: Multi-Stage Dockerfile for Next.js Standalone

**What:** Three-stage build for minimal production image.
**Source:** [CITED: github.com/vercel/next.js/examples/with-docker]

```dockerfile
# apps/web/Dockerfile
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Stage 2: Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @beagle-console/shared build && \
    pnpm --filter @beagle-console/db build && \
    pnpm --filter @beagle-console/web build

# Stage 3: Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

**Key gotcha with monorepo standalone output:** Next.js standalone output traces dependencies into a `.next/standalone` directory that mirrors the monorepo structure. The `server.js` entry point will be at `.next/standalone/apps/web/server.js`, not `.next/standalone/server.js`. The COPY and CMD paths in the Dockerfile must account for this. Test locally with `node apps/web/.next/standalone/apps/web/server.js` to verify. [ASSUMED -- exact path structure needs verification after first build]

### Pattern 5: Drizzle Multi-Tenant Schema

**What:** `pgSchema()` factory for tenant isolation + custom migration runner.
**Source:** [CITED: orm.drizzle.team/docs/sql-schema-declaration, medium.com/@vimulatus]

```typescript
// packages/db/src/schema/shared.ts
import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const shared = pgSchema('shared');

export const tenants = shared.table('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  vaultPath: text('vault_path'),  // Obsidian vault directory
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

```typescript
// packages/db/src/schema/tenant.ts
import { pgSchema, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export function createTenantSchema(tenantId: string) {
  const schema = pgSchema(`tenant_${tenantId}`);

  const runs = schema.table('runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title'),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });

  const messages = schema.table('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull(),
    agentName: text('agent_name'),
    content: text('content').notNull(),
    sequence: integer('sequence').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  return { runs, messages };
}
```

```typescript
// packages/db/src/migrate.ts -- Custom multi-tenant migration runner
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function migrateAll() {
  const db = drizzle(pool);

  // 1. Migrate shared schema
  await migrate(db, {
    migrationsFolder: './migrations/shared',
    migrationsSchema: 'shared',
  });

  // 2. Get all tenant schemas
  const result = await db.execute(sql`
    SELECT id FROM shared.tenants
  `);

  // 3. Migrate each tenant schema
  for (const row of result.rows) {
    const tenantId = row.id as string;
    const schemaName = `tenant_${tenantId}`;

    // Ensure schema exists
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`);

    // Apply tenant migrations with schema-specific migrations table
    await db.execute(sql`SET search_path TO ${sql.identifier(schemaName)}`);
    await migrate(db, {
      migrationsFolder: './migrations/tenant',
      migrationsSchema: schemaName,
      migrationsTable: '__drizzle_migrations',
    });
    await db.execute(sql`SET search_path TO public`);
  }

  console.log('All migrations complete');
  await pool.end();
}
```

**Important:** The `migrate()` function from `drizzle-orm/node-postgres/migrator` accepts `migrationsSchema` and `migrationsTable` parameters per the Drizzle docs. This means each tenant schema can have its own migration tracking table, enabling independent migration state per tenant. [VERIFIED: orm.drizzle.team/docs/migrations]

### Pattern 6: Caddy Configuration Block

**What:** Add console.beaglemind.ai to existing Caddyfile.
**Source:** [VERIFIED: caddyserver.com/docs/caddyfile/directives/reverse_proxy]

```
# Added to /opt/beaglehq/caddy/Caddyfile (existing file)
console.beaglemind.ai {
    reverse_proxy console-web:3000 {
        flush_interval -1
    }
}
```

**Notes:**
- Caddy auto-provisions TLS via Let's Encrypt. No manual cert setup needed.
- `flush_interval -1` disables buffering for SSE streaming. Without this, SSE events batch up. [VERIFIED: caddyserver.com/docs -- flush_interval -1 = low-latency mode]
- Caddy handles WebSocket upgrade headers automatically -- no special config needed. [VERIFIED: caddyserver.com/docs]
- The `console-web` hostname works because the web container joins `beaglehq_frontend`, the same network as Caddy.
- DNS A record must be created BEFORE Caddy tries to provision the cert, otherwise ACME challenge fails.

### Pattern 7: MinIO Init Script

**What:** Sidecar container that creates initial buckets on MinIO startup.
**Source:** [CITED: banach.net.pl/posts/2025/creating-bucket-automatically-on-local-minio-with-docker-compose]

```yaml
# In docker-compose.yml, alongside minio service
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_started
    entrypoint: >
      /bin/sh -c "
      sleep 5;
      mc alias set local http://minio:9000 minioadmin $${MINIO_ROOT_PASSWORD};
      mc mb local/system --ignore-existing;
      echo 'MinIO initialization complete';
      "
    networks:
      - beaglehq_backend
    restart: "no"
```

Tenant-specific buckets are created by the tenant provisioning script (D-13), not at Docker startup. The init script only creates a `system` bucket for shared assets.

### Pattern 8: GitHub Actions CI/CD

**What:** Build, push to GHCR, deploy via SSH.
**Source:** [CITED: docs.servicestack.net/ssh-docker-compose-deploment]

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push console-web
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/beaglemind/console-web:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push console-agent-hub
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/agent-hub/Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/beaglemind/console-agent-hub:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push console-worker
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/worker/Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/beaglemind/console-worker:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to BeagleHQ
        uses: appleboy/ssh-action@v1
        with:
          host: 46.224.167.166
          username: lucas
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/beagle-console
            echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker compose pull
            docker compose up -d
```

**Required GitHub Secrets:**
- `SSH_PRIVATE_KEY` -- Private key for SSH access to BeagleHQ as user `lucas`
- `GITHUB_TOKEN` -- Auto-provided by GitHub Actions, has `packages:write` scope

### Pattern 9: Vault Path Resolver

**What:** Maps tenant_id to Obsidian vault directory path.
**Source:** [ASSUMED -- custom utility based on D-19]

```typescript
// packages/db/src/vault-resolver.ts
import { eq } from 'drizzle-orm';
import { tenants } from './schema/shared';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export async function resolveVaultPath(
  db: NodePgDatabase,
  tenantId: string
): Promise<string | null> {
  const result = await db
    .select({ vaultPath: tenants.vaultPath })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return result[0]?.vaultPath ?? null;
}

// For v1: vaults are on BeagleHQ filesystem, synced via Dropbox
// Typical path: /home/lucas/Dropbox/Vaults/{tenant-slug}
// Future: could resolve to network path, S3 prefix, etc.
```

### Anti-Patterns to Avoid

- **Modifying BeagleHQ compose files:** Console MUST be a separate compose stack. Touching `/opt/beaglehq/` risks breaking existing services.
- **Using `host.docker.internal` for Postgres/Redis:** Since containers join the same Docker network as Postgres/Redis, use container hostnames directly (e.g., `beaglehq-postgres-1`), not `host.docker.internal`. [VERIFIED: Docker networking docs -- containers on the same network resolve each other by name]
- **Pool-per-tenant:** Decision D-11 explicitly forbids this. Use shared pool + schema scoping.
- **Running `drizzle-kit push` in production:** Use `drizzle-kit generate` to create SQL files, then apply them via the custom migration runner. Push is for dev only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-stage Docker builds | Custom build scripts | Docker multi-stage + buildx | Layer caching, build cache, proven pattern |
| TLS certificate management | Let's Encrypt scripts | Caddy auto-TLS | Caddy handles ACME challenge, renewal, OCSP stapling automatically |
| S3-compatible storage | File system abstraction | MinIO + @aws-sdk/client-s3 | Presigned URLs, bucket policies, standard API |
| CI/CD pipeline | Custom deploy scripts | GitHub Actions + standard actions | docker/build-push-action, appleboy/ssh-action are battle-tested |
| pnpm workspace linking | Custom symlinks | pnpm workspace:* protocol | Handles hoisting, resolution, lockfile automatically |

## Common Pitfalls

### Pitfall 1: Next.js Standalone Monorepo Path Issues
**What goes wrong:** The standalone output mirrors the monorepo directory structure. `server.js` is not at the root of `.next/standalone/` but at `.next/standalone/apps/web/server.js`. The `public/` and `.next/static/` directories also need to be copied to the correct relative paths.
**Why it happens:** Next.js output file tracing follows the monorepo structure.
**How to avoid:** After first build, inspect `.next/standalone/` directory structure. Adjust Dockerfile COPY paths accordingly. Test locally with `node .next/standalone/apps/web/server.js`.
**Warning signs:** Container starts but serves 404 for all routes, or missing static assets.

### Pitfall 2: External Network Must Exist Before `docker compose up`
**What goes wrong:** `docker compose up` fails with "network beaglehq_backend not found" if BeagleHQ stack is not running.
**Why it happens:** `external: true` means Docker Compose does not create the network -- it expects it to already exist.
**How to avoid:** Start BeagleHQ stack first, or create networks manually with `docker network create beaglehq_backend` as a fallback. Add a health check / dependency note in deployment docs.
**Warning signs:** Compose exits immediately with network error.

### Pitfall 3: DNS Must Propagate Before Caddy TLS
**What goes wrong:** Caddy fails ACME TLS challenge because DNS for console.beaglemind.ai does not point to the VPS yet.
**Why it happens:** Let's Encrypt validates domain ownership by connecting to the IP the DNS resolves to. If DNS is not yet propagated, the challenge fails.
**How to avoid:** Create DNS A record at STRATO first. Wait for propagation (check with `dig console.beaglemind.ai`). Then reload Caddy. Caddy retries automatically but may take time.
**Warning signs:** Caddy logs show ACME challenge failure. Site not accessible via HTTPS.

### Pitfall 4: pnpm in Docker -- Corepack and Lockfile
**What goes wrong:** Docker build fails because `pnpm` is not available in the base image, or lockfile mismatch.
**Why it happens:** `node:22-slim` does not have pnpm pre-installed. You need `corepack enable` and possibly `corepack prepare pnpm@latest --activate`.
**How to avoid:** Add `RUN corepack enable` in the base stage. Include `packageManager` field in root `package.json` to pin pnpm version. Copy `pnpm-lock.yaml` before install.
**Warning signs:** "pnpm: command not found" or "ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE".

### Pitfall 5: Drizzle migrate() with SET search_path Race Conditions
**What goes wrong:** If the connection pool is shared and another query runs between `SET search_path` and `migrate()`, the search_path may be wrong.
**Why it happens:** `SET search_path` affects the session/connection, not the transaction. Pool connections are shared.
**How to avoid:** Use a dedicated connection (not from the pool) for migration. Or wrap the SET + migrate in a transaction. The migration runner should create its own Pool with `max: 1` connection.
**Warning signs:** Migrations applied to wrong schema. Tables appear in `public` instead of `tenant_xxx`.

### Pitfall 6: Postgres Container Name on External Network
**What goes wrong:** Connection string uses wrong hostname for Postgres. The container name on the external network might be `beaglehq-postgres-1` or just `postgres` depending on how BeagleHQ compose defines it.
**Why it happens:** Docker Compose generates container names as `{project}_{service}_{replica}` or `{project}-{service}-{replica}` depending on Compose version.
**How to avoid:** SSH to BeagleHQ, run `docker ps --format '{{.Names}}'` to get exact container names. Also check `docker network inspect beaglehq_backend` for connected container names.
**Warning signs:** "could not connect to server: Name does not resolve" in container logs.

## Code Examples

### Creating the beagle_console Database

```bash
# SSH to BeagleHQ, execute in existing Postgres container
docker exec -it beaglehq-postgres-1 psql -U postgres -c "CREATE DATABASE beagle_console;"

# Create shared schema
docker exec -it beaglehq-postgres-1 psql -U postgres -d beagle_console -c "CREATE SCHEMA shared;"
```

### Next.js Config for Standalone Output

```typescript
// apps/web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@beagle-console/db', '@beagle-console/shared'],
};

export default nextConfig;
```

**Note:** `transpilePackages` is needed for Next.js to resolve and bundle workspace packages. Without it, imports from `@beagle-console/db` fail at build time. [VERIFIED: Next.js docs -- transpilePackages for monorepo packages]

### .dockerignore (Root Level)

```
node_modules
.next
.git
.github
*.md
.env*
```

### Tailwind Dark Theme Setup (from CONTEXT.md specifics)

```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1115',
        panel: '#161922',
        accent: '#f7b733',       // beagle gold
        'accent-2': '#4db6ac',   // jarvis teal
        'accent-3': '#c86bfa',   // sentinel purple (adjusted from #c86bff)
        user: '#6ea8fe',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` at root (Wave 0 creation needed) |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | Docker Compose starts 3 containers + MinIO | smoke | `docker compose -f docker/docker-compose.yml config` (validates syntax) | No -- Wave 0 |
| INFR-02 | Caddy routes to console-web container | smoke | Manual -- requires deployed env | N/A manual-only |
| INFR-03 | Memory limits set on containers | unit | `pnpm vitest run tests/docker-compose-config.test.ts` (parse and assert limits in YAML) | No -- Wave 0 |
| INFR-04 | CI/CD workflow syntax valid | unit | `actionlint .github/workflows/deploy.yml` | No -- Wave 0 |
| INFR-05 | Monorepo packages resolve cross-deps | smoke | `pnpm install && pnpm -r build` | No -- Wave 0 |
| INFR-06 | Vault resolver returns path for tenant | unit | `pnpm vitest run packages/db/src/__tests__/vault-resolver.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run` (quick, unit tests only)
- **Per wave merge:** `pnpm -r build && pnpm vitest run` (build + test)
- **Phase gate:** Full build + `docker compose config` validation + vault resolver tests

### Wave 0 Gaps
- [ ] `vitest.config.ts` at root -- workspace-level Vitest config
- [ ] `packages/db/src/__tests__/vault-resolver.test.ts` -- vault resolver unit test
- [ ] Vitest install: `pnpm add -Dw vitest` (already planned in devDependencies)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 2) | -- |
| V3 Session Management | No (Phase 2) | -- |
| V4 Access Control | Partially | Tenant schema isolation prevents cross-tenant access at DB level |
| V5 Input Validation | Yes | Zod schemas in packages/shared for all shared types |
| V6 Cryptography | No | -- |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exposed MinIO credentials | Information Disclosure | Environment variables, not hardcoded. .env files not committed. |
| Docker container escape | Elevation of Privilege | Non-root USER in Dockerfiles, resource limits, read-only filesystem where possible |
| SSH key exposure in CI | Spoofing | GitHub encrypted secrets, minimal key permissions |
| Tenant schema data leakage | Information Disclosure | pgSchema() scoping, middleware-enforced tenant context (Phase 2 implementation) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm workspaces` | `pnpm workspaces` | 2023+ | Better hoisting, faster installs, strict mode prevents phantom deps |
| `next export` for static | `output: 'standalone'` for Docker | Next.js 12+ | Self-contained server, no need for custom server.js |
| Docker Compose v1 (`docker-compose`) | Docker Compose v2 (`docker compose`) | 2023 | Plugin-based, `docker compose` not `docker-compose` |
| Prisma | Drizzle ORM | 2024+ | Lighter, no binary engine, native pgSchema() for multi-tenant |
| `eslint` + `prettier` | Biome | 2024+ | Single tool, faster, less config |
| Zod 3.x | Zod 4.x | 2025 | Performance improvements, new API. Note: zod 4.3.6 is current latest. |

**Note on Zod 4:** The STACK.md references Zod 3.x, but npm registry shows Zod 4.3.6 as latest. Zod 4 has breaking API changes. The decision should use Zod 4 since this is a greenfield project. [VERIFIED: npm registry -- zod@4.3.6 is latest]

**Note on TypeScript:** TypeScript 6.0.3 is now latest on npm, but Decision D-03 locks to 5.7+. Using 5.7.3 is correct for now. TS 6.0 may have breaking changes worth evaluating later. [VERIFIED: npm registry]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Postgres container name is `beaglehq-postgres-1` on the beaglehq_backend network | Architecture Patterns, Pattern 3 | Connection strings wrong, all services fail to connect |
| A2 | Redis container name is `beaglehq-redis-1` on the beaglehq_backend network | Architecture Patterns, Pattern 3 | Connection strings wrong, BullMQ/pub-sub fail |
| A3 | Next.js standalone output in monorepo puts server.js at `apps/web/.next/standalone/apps/web/server.js` | Pitfall 1 | Dockerfile CMD path wrong, container won't start |
| A4 | GitHub org is named `beaglemind` for GHCR image paths | Pattern 8 | Image push/pull fails in CI/CD |
| A5 | Existing Caddyfile is at `/opt/beaglehq/caddy/Caddyfile` and can be edited to add new site block | Pattern 6 | Caddy config location wrong, or Caddy uses different config format |
| A6 | Vault directories are at `/home/lucas/Dropbox/Vaults/{tenant-slug}` | Pattern 9 | Vault resolver returns wrong paths |


## Open Questions (RESOLVED)

1. **Exact Postgres/Redis container names on BeagleHQ** -- RESOLVED: discovered at execution time via SSH per Plan 01-02 T1. Plan 01-02 T1 action explicitly SSHes to BeagleHQ to discover container names before writing connection strings.

2. **BeagleHQ Caddyfile format and location** -- RESOLVED: discovered at execution time via SSH per Plan 01-02 T1. Plan 01-02 T2 reads the existing Caddyfile before modifying it.

3. **Postgres user/password for new database** -- RESOLVED: discovered at execution time via SSH per Plan 01-02 T1. Plan 01-02 T1 reads /opt/beaglehq/.env to get credentials.

4. **GitHub org name for GHCR** -- RESOLVED: `beaglemind` org per D-16. Plan 01-03 uses lowercase `beaglemind` as GHCR org path (GitHub lowercases org names in GHCR URLs).

5. **STRATO DNS management** -- RESOLVED: delegated to user via user_setup DNS task in Plan 01-02. User creates A record at STRATO; Plan 01-02 T2 checkpoint verifies after DNS propagation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | Monorepo management | Needs install | -- | `corepack enable && corepack prepare pnpm@10 --activate` |
| Node.js | All services | Needs verification | -- | Install via nvm |
| Docker | Container deployment | On BeagleHQ VPS | Needs verification | -- |
| Docker Compose | Container orchestration | On BeagleHQ VPS | Needs verification | -- |
| PostgreSQL 17.4 | Database | On BeagleHQ VPS (container) | 17.4 | -- |
| Redis 7.x | Pub/sub, BullMQ | On BeagleHQ VPS (container) | Needs verification | -- |
| Caddy | Reverse proxy | On BeagleHQ VPS (container) | Needs verification | -- |
| GitHub Actions | CI/CD | GitHub cloud | Available | -- |
| STRATO DNS | Domain management | External service | Available | -- |

**Note:** Development happens locally but deployment targets BeagleHQ VPS. Local dev tools (pnpm, Node) need to be available on the development machine. Docker/Compose/Postgres/Redis are on the VPS only. The CI/CD pipeline handles the bridge.

**Missing dependencies with no fallback:** None identified -- all infrastructure exists on BeagleHQ.

**Missing dependencies with fallback:** pnpm on local dev machine (install via corepack).

## Sources

### Primary (HIGH confidence)
- [npm registry] -- Verified versions: Next.js 15.5.15, Drizzle 0.45.2, drizzle-kit 0.31.10, ws 8.20.0, BullMQ 5.75.2, zod 4.3.6, TypeScript 5.7.3, Biome 2.4.12, Vitest 4.1.5
- [Docker Compose networking docs](https://docs.docker.com/compose/how-tos/networking/) -- External network syntax
- [Caddy reverse_proxy docs](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) -- flush_interval, WebSocket handling
- [Drizzle ORM migrations docs](https://orm.drizzle.team/docs/migrations) -- migrationsSchema parameter
- [Next.js Docker example](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile) -- Multi-stage Dockerfile

### Secondary (MEDIUM confidence)
- [Schema-based Multi-Tenancy with Drizzle ORM](https://medium.com/@vimulatus/schema-based-multi-tenancy-with-drizzle-orm-6562483c9b03) -- pgSchema factory pattern
- [MinIO bucket auto-creation](https://banach.net.pl/posts/2025/creating-bucket-automatically-on-local-minio-with-docker-compose/) -- mc init container pattern
- [GitHub Actions SSH deploy](https://docs.servicestack.net/ssh-docker-compose-deploment) -- appleboy/ssh-action workflow
- [pnpm workspaces](https://pnpm.io/next/workspaces) -- Workspace configuration

### Tertiary (LOW confidence)
- drizzle-multitenant npm package (v1.3.5, 2 GitHub stars) -- Evaluated but not recommended due to low adoption

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry
- Architecture: HIGH -- patterns well-documented, Docker/Caddy/pnpm are mature
- Multi-tenant Drizzle: MEDIUM -- custom migration runner pattern is community-sourced, not officially documented
- Pitfalls: HIGH -- documented from official sources and community experience
- CI/CD: HIGH -- standard GitHub Actions pattern with well-maintained actions

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable technologies, 30-day validity)
