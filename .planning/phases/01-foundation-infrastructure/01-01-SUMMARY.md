---
phase: 01-foundation-infrastructure
plan: 01
subsystem: infra
tags: [pnpm, monorepo, drizzle, typescript, nextjs, tailwind, zod, minio, s3, multi-tenant]

requires: []
provides:
  - pnpm monorepo with 5 workspace packages (web, agent-hub, worker, db, shared)
  - Drizzle ORM multi-tenant schema (shared + tenant_{uuid} factory)
  - Vault path resolver for tenant-to-Obsidian mapping
  - Tenant provisioning function with MinIO bucket creation
  - Multi-tenant migration runner with dedicated connection
  - MinIO S3 client wrapper using @aws-sdk/client-s3
  - Zod-validated shared types (RunStatus, AgentName)
  - Tailwind v4 dark theme with beagle gold, jarvis teal, sentinel purple
  - Next.js 15.5 standalone output configuration
affects: [01-02, 01-03, 02-auth, 03-agent-hub, 04-ui]

tech-stack:
  added: [next@15.5.15, react@19, drizzle-orm@0.45.2, postgres@3.4.7, ws@8.20.0, bullmq@5.75.2, zod@4.3.6, "@aws-sdk/client-s3@3.1033.0", typescript@5.7.3, "@biomejs/biome@2.4.12", vitest@4.1.5, tailwindcss@4, "@tailwindcss/postcss"]
  patterns: [pnpm workspace:* cross-references, tsconfig.base.json extension, pgSchema multi-tenant factory, shared connection pool with max:25, CSS-first Tailwind v4 theme]

key-files:
  created:
    - pnpm-workspace.yaml
    - tsconfig.base.json
    - vitest.config.ts
    - apps/web/app/layout.tsx
    - apps/web/app/globals.css
    - apps/web/next.config.ts
    - apps/agent-hub/src/index.ts
    - apps/worker/src/index.ts
    - packages/db/src/schema/shared.ts
    - packages/db/src/schema/tenant.ts
    - packages/db/src/client.ts
    - packages/db/src/vault-resolver.ts
    - packages/db/src/migrate.ts
    - packages/db/src/provision-tenant.ts
    - packages/db/src/minio-client.ts
    - packages/db/drizzle.config.ts
    - packages/shared/src/index.ts
  modified: []

key-decisions:
  - "Used Zod v4 import path (zod/v4) for greenfield compatibility"
  - "Added @types/node as root devDependency for Node.js process/http types across all packages"
  - "Excluded dist/ from vitest to prevent duplicate test execution from compiled output"

patterns-established:
  - "Multi-tenant schema: pgSchema('shared') for system tables, createTenantSchema(id) factory for tenant_{uuid} schemas"
  - "Shared connection pool: max 25, never pool-per-tenant"
  - "Migration runner: dedicated max:1 connection to prevent search_path races"
  - "MinIO integration: @aws-sdk/client-s3 with forcePathStyle, env-based credentials"
  - "Workspace cross-refs: workspace:* protocol in package.json dependencies"

requirements-completed: [INFR-05, INFR-06]

duration: 7min
completed: 2026-04-21
---

# Phase 1 Plan 1: Monorepo Scaffold Summary

**pnpm monorepo with 5 packages, Drizzle multi-tenant schema with pgSchema factory, vault resolver, MinIO client, and Tailwind v4 dark theme**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-21T14:28:44Z
- **Completed:** 2026-04-21T14:35:39Z
- **Tasks:** 2
- **Files modified:** 37

## Accomplishments

- Complete pnpm monorepo: apps/web (Next.js 15.5), apps/agent-hub (ws), apps/worker (BullMQ), packages/db (Drizzle), packages/shared (Zod)
- Drizzle multi-tenant schema with shared.tenants table and createTenantSchema() factory producing runs + messages tables per tenant
- Tenant provisioning function that creates DB record, PostgreSQL schema, and MinIO bucket
- Vault path resolver, migration runner (dedicated max:1 pool), and MinIO S3 client wrapper
- Dark theme CSS variables (beagle gold, jarvis teal, sentinel purple) via Tailwind v4 @theme

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold monorepo structure** - `c831419` (feat)
2. **Task 2: Drizzle schema, tests, drizzle config** - `8d131fe` (test)
3. **Fix: Exclude dist/ from vitest** - `05b30c7` (fix)

## Files Created/Modified

- `pnpm-workspace.yaml` - Workspace package declarations (apps/*, packages/*)
- `package.json` - Root scripts and devDependencies, packageManager pnpm@10.33.0
- `tsconfig.base.json` - Shared strict TS config (ES2022, bundler resolution, noUncheckedIndexedAccess)
- `biome.json` - Lint + format config (space indent, recommended rules)
- `vitest.config.ts` - Test runner config with dist/ exclusion
- `apps/web/package.json` - Next.js 15.5.15 with workspace deps
- `apps/web/next.config.ts` - Standalone output + transpilePackages
- `apps/web/app/globals.css` - Tailwind v4 @theme with dark color palette
- `apps/web/app/layout.tsx` - Root layout with dark theme body
- `apps/web/app/page.tsx` - Placeholder page proving styling works
- `apps/web/postcss.config.mjs` - @tailwindcss/postcss plugin
- `apps/agent-hub/src/index.ts` - HTTP health check on port 3001
- `apps/worker/src/index.ts` - Placeholder worker startup
- `packages/db/src/schema/shared.ts` - pgSchema('shared') with tenants table
- `packages/db/src/schema/tenant.ts` - createTenantSchema() factory (runs, messages)
- `packages/db/src/client.ts` - Shared connection pool (max: 25)
- `packages/db/src/vault-resolver.ts` - resolveVaultPath() for tenant-to-vault mapping
- `packages/db/src/migrate.ts` - migrateAll() with dedicated max:1 connection
- `packages/db/src/provision-tenant.ts` - provisionTenant() with MinIO bucket creation
- `packages/db/src/minio-client.ts` - getMinioClient() and ensureBucket() via @aws-sdk/client-s3
- `packages/db/src/index.ts` - Re-exports all db modules
- `packages/db/drizzle.config.ts` - drizzle-kit config for shared schema
- `packages/db/src/__tests__/vault-resolver.test.ts` - 4 tests for vault resolver and tenant schema
- `packages/shared/src/index.ts` - RunStatus and AgentName Zod enums

## Decisions Made

- **Zod v4 import path:** Used `zod/v4` import for Zod 4.x compatibility (greenfield, no migration concerns)
- **@types/node at root:** Added as root devDependency so all packages resolve Node.js types without individual installs
- **dist/ exclusion in vitest:** tsc build output was being picked up as duplicate test files; added explicit exclude

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @types/node causing tsc failures**
- **Found during:** Task 1 (build verification)
- **Issue:** `process` and `node:http` types unresolved across packages/db and apps/agent-hub
- **Fix:** Added `@types/node` as root devDependency
- **Files modified:** package.json
- **Verification:** `pnpm -r build` succeeds
- **Committed in:** c831419 (Task 1 commit)

**2. [Rule 1 - Bug] Vitest discovering compiled dist/ test files**
- **Found during:** Task 2 (test verification)
- **Issue:** `pnpm vitest run` found 2 test files (src + dist) running 8 tests instead of 4
- **Fix:** Added `exclude: ['**/node_modules/**', '**/dist/**']` to vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** `pnpm vitest run` shows 1 file, 4 tests
- **Committed in:** 05b30c7

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct build and test execution. No scope creep.

## Issues Encountered

- pnpm `approve-builds` interactive prompt selected "no builds" by default; resolved by using `onlyBuiltDependencies` in pnpm-workspace.yaml to allow esbuild and sharp
- Next.js auto-modified apps/web/tsconfig.json on first build (added lib, allowJs, noEmit, incremental) -- expected behavior

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Monorepo builds cleanly, ready for Docker Compose (Plan 01-02)
- All workspace cross-references resolve
- Database schema and tenant utilities ready for deployment
- Tailwind dark theme established for UI development

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-04-21*
