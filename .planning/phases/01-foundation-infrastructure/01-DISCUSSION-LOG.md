# Phase 1: Foundation & Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 01-foundation-infrastructure
**Areas discussed:** Monorepo structure, Docker deployment, Database schema, CI/CD pipeline
**Mode:** --auto (all decisions auto-selected as recommended defaults)

---

## Monorepo Structure

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm workspaces | Fast, native workspace support, no extra tooling | ✓ |
| Turborepo | Build caching, task pipeline — overkill for 3 apps | |
| npm workspaces | Slower, less mature workspace support | |

**User's choice:** pnpm workspaces [auto-selected]
**Notes:** Turborepo adds complexity without benefit at this scale. pnpm's built-in workspace support handles dependency hoisting and cross-package builds.

| Option | Description | Selected |
|--------|-------------|----------|
| packages/db + packages/shared | Drizzle schema shared, Zod types shared | ✓ |
| Single packages/common | Everything in one shared package | |

**User's choice:** packages/db + packages/shared [auto-selected]
**Notes:** Separation allows apps to import only what they need. packages/db has Drizzle dependency; packages/shared is dependency-free types.

---

## Docker Deployment

| Option | Description | Selected |
|--------|-------------|----------|
| Separate compose, external networks | Console's own compose.yaml joining BeagleHQ networks | ✓ |
| Extend BeagleHQ compose | Add console services to existing compose.yaml | |
| Fully isolated stack | Own Postgres, own Redis, own Caddy | |

**User's choice:** Separate compose, external networks [auto-selected]
**Notes:** Avoids modifying Henrik's infrastructure. Console joins existing networks for Postgres/Redis/Caddy access.

| Option | Description | Selected |
|--------|-------------|----------|
| node:22-slim | LTS, smallest footprint | ✓ |
| node:22-alpine | Even smaller but musl libc compatibility issues | |
| node:22 | Full Debian — larger image, unnecessary | |

**User's choice:** node:22-slim [auto-selected]

---

## Database Schema

| Option | Description | Selected |
|--------|-------------|----------|
| New database in existing Postgres | beagle_console DB alongside beaglehq DB | ✓ |
| Separate Postgres container | Full isolation but more memory | |

**User's choice:** New database in existing Postgres [auto-selected]
**Notes:** Per user's earlier decision. Tenant isolation via schemas, not containers.

| Option | Description | Selected |
|--------|-------------|----------|
| tenant_{uuid} schemas | UUID-based, no collision risk | ✓ |
| tenant_{slug} schemas | Human-readable but slug management overhead | |
| Shared schema with row-level security | No schema isolation — higher leakage risk | |

**User's choice:** tenant_{uuid} schemas [auto-selected]

| Option | Description | Selected |
|--------|-------------|----------|
| Custom migration runner | ~100 lines, iterates schemas, applies SQL | ✓ |
| drizzle-kit push per schema | Manual, doesn't scale | |
| drizzle-multitenant package | 2 GitHub stars, unproven | |

**User's choice:** Custom migration runner [auto-selected]
**Notes:** Research confirmed drizzle-kit targets single schema. Custom runner is the proven pattern.

---

## CI/CD Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions + SSH deploy | Push to main → GHCR → SSH pull on BeagleHQ | ✓ |
| GitHub Actions + Watchtower | Auto-pull on image push — less control | |
| Manual deploy | SSH + git pull — no automation | |

**User's choice:** GitHub Actions + SSH deploy [auto-selected]

---

## Claude's Discretion

- pnpm workspace config details
- Dockerfile layer optimization
- GitHub Actions YAML specifics
- Drizzle table definitions
- MinIO configuration

## Deferred Ideas

None
