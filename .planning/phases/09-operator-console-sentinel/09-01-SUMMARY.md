---
phase: 09-operator-console-sentinel
plan: 01
subsystem: auth, database, ui
tags: [better-auth, drizzle, operator-role, sentinel, cli, provisioning]

requires:
  - phase: 02-auth-tenant
    provides: provisionTenantWithAuth, auth schema, Better Auth setup
  - phase: 06-clean-studio-modes
    provides: sentinel-section.tsx component in Studio process drawer

provides:
  - CLI tenant provisioning script (pnpm --filter @beagle-console/db run provision-tenant)
  - isOperator flag on users table for role gating
  - breakGlassAudit table in tenant schema for audit trail
  - operator.ts utility (requireOperator, isOperator) for route protection
  - sentinel_flag event type in shared MessageType enum

affects: [09-02, 09-03, operator-dashboard, break-glass-flow]

tech-stack:
  added: [better-auth (packages/db)]
  patterns: [operator role via boolean flag on users, CLI wrapping existing provisioning function]

key-files:
  created:
    - packages/db/src/scripts/provision-tenant-cli.ts
    - apps/web/lib/operator.ts
  modified:
    - packages/db/src/schema/auth-schema.ts
    - packages/db/src/schema/tenant.ts
    - packages/shared/src/hub-events.ts
    - apps/web/components/studio/sentinel-section.tsx
    - packages/db/package.json

key-decisions:
  - "Operator role as simple boolean flag on users table (Year-1 only Lucas operates)"
  - "CLI creates standalone Better Auth instance without nextCookies plugin for server-side provisioning"
  - "Added sentinel_flag to shared MessageType enum so TypeScript accepts the event type"

patterns-established:
  - "Operator gating: requireOperator() redirects non-operators to /dashboard, pattern mirrors requireTenantContext()"
  - "CLI provisioning: standalone Better Auth instance for scripts running outside Next.js"

requirements-completed: [OPER-01, OPER-03]

duration: 3min
completed: 2026-04-21
---

# Phase 9 Plan 01: Operator Infrastructure Summary

**CLI tenant provisioning script, operator role flag with gate utilities, break-glass audit schema, and sentinel_flag event type support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T19:41:19Z
- **Completed:** 2026-04-21T19:44:18Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- CLI provisioning script wrapping provisionTenantWithAuth with standalone Better Auth instance
- isOperator boolean flag on users table + operator.ts utility module with requireOperator()/isOperator()
- breakGlassAudit table added to tenant schema for break-glass access audit trail
- sentinel_flag added to MessageType enum and sentinel-section.tsx handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema additions + operator role flag + CLI provisioning script** - `80b0bf6` (feat)
2. **Task 2: Operator utility module and sentinel data flow verification** - `083121c` (feat)

## Files Created/Modified
- `packages/db/src/scripts/provision-tenant-cli.ts` - CLI entrypoint for tenant provisioning with arg parsing
- `apps/web/lib/operator.ts` - Operator role check utilities (isOperator, requireOperator)
- `packages/db/src/schema/auth-schema.ts` - Added isOperator boolean flag to users table
- `packages/db/src/schema/tenant.ts` - Added breakGlassAudit table to tenant schema
- `packages/shared/src/hub-events.ts` - Added sentinel_flag to MessageType enum
- `apps/web/components/studio/sentinel-section.tsx` - Added sentinel_flag event type handler
- `packages/db/package.json` - Added provision-tenant script and better-auth dependency

## Decisions Made
- Operator role as simple boolean flag on users table -- cleanest for Year-1 where only Lucas operates
- CLI script creates its own Better Auth instance (same config as apps/web minus nextCookies) to avoid cross-package import of Next.js auth
- Added sentinel_flag to shared MessageType enum (Rule 3 - blocking) so TypeScript accepts the type comparison in sentinel-section.tsx

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added sentinel_flag to MessageType enum**
- **Found during:** Task 2 (sentinel-section.tsx update)
- **Issue:** TypeScript error TS2367 -- comparing event.type against 'sentinel_flag' failed because it wasn't in the MessageType union
- **Fix:** Added 'sentinel_flag' to the z.enum in packages/shared/src/hub-events.ts
- **Files modified:** packages/shared/src/hub-events.ts
- **Verification:** npx tsc --noEmit passes for both packages/db and apps/web
- **Committed in:** 083121c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for type safety. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Operator infrastructure in place for Plans 02 (operator dashboard) and 03 (break-glass flow)
- sentinel_flag events will display in Studio once Sam starts producing them
- breakGlassAudit table ready for Plan 03 to implement the break-glass access flow

---
*Phase: 09-operator-console-sentinel*
*Completed: 2026-04-21*
