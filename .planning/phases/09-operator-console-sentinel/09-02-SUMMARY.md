---
phase: 09-operator-console-sentinel
plan: 02
subsystem: ui, api
tags: [operator-dashboard, health-checks, sentinel, tanstack-query, drizzle, cross-tenant]

requires:
  - phase: 09-operator-console-sentinel
    provides: requireOperator(), isOperator flag, sentinel_flag event type

provides:
  - Operator dashboard at /operator with health cards, stats, active runs
  - Aggregated sentinel flags view at /operator/sentinel
  - 4 operator API routes (health, stats, runs, sentinel)
  - requireOperatorApi() for API route contexts

affects: [09-03, break-glass-flow, operator-monitoring]

tech-stack:
  added: []
  patterns: [requireOperatorApi for API routes (no redirect), cross-tenant iteration with createTenantSchema, client-side sortable tables]

key-files:
  created:
    - apps/web/app/(operator)/layout.tsx
    - apps/web/app/(operator)/operator/page.tsx
    - apps/web/app/(operator)/operator/sentinel/page.tsx
    - apps/web/app/api/operator/health/route.ts
    - apps/web/app/api/operator/runs/route.ts
    - apps/web/app/api/operator/sentinel/route.ts
    - apps/web/app/api/operator/stats/route.ts
    - apps/web/components/operator/health-cards.tsx
    - apps/web/components/operator/active-runs-table.tsx
    - apps/web/components/operator/sentinel-flags-table.tsx
  modified:
    - apps/web/lib/operator.ts

key-decisions:
  - "Added requireOperatorApi() that returns null instead of redirecting, safe for API route handlers"
  - "Cross-tenant queries iterate tenants sequentially with try/catch per schema (Year-1 scale)"
  - "Client-side sorting for sentinel table (data capped at 200 rows server-side)"

patterns-established:
  - "Operator API pattern: requireOperatorApi() returns null for non-operators, caller returns 403"
  - "Cross-tenant query pattern: fetch tenants, iterate with createTenantSchema, aggregate results"

requirements-completed: [OPER-02, OPER-04]

duration: 4min
completed: 2026-04-21
---

# Phase 9 Plan 02: Operator Dashboard Summary

**Operator web dashboard with system health cards (Postgres/Redis/MinIO/Hub), cross-tenant active runs table, cost overview, and aggregated sentinel flags view**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T19:46:48Z
- **Completed:** 2026-04-21T19:50:38Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Operator dashboard at /operator showing 4-service health cards with latency, stat cards (tenants/runs/cost), and active runs table
- Aggregated sentinel flags view at /operator/sentinel with sortable columns (severity, time, tenant, agent)
- 4 operator API routes all gated by requireOperatorApi() returning 403 for non-operators
- Added requireOperatorApi() utility for API route contexts (no redirect, returns null)

## Task Commits

Each task was committed atomically:

1. **Task 1: Operator API routes (health, stats, runs, sentinel)** - `d03d081` (feat)
2. **Task 2: Operator route group, dashboard page, and sentinel page** - `a3ef3ac` (feat)

## Files Created/Modified
- `apps/web/app/api/operator/health/route.ts` - Health checks for Postgres, Redis, MinIO, Hub with latency
- `apps/web/app/api/operator/stats/route.ts` - Tenant count, active runs count, cost windows (24h/7d/30d)
- `apps/web/app/api/operator/runs/route.ts` - Cross-tenant active runs with project info, sorted by time
- `apps/web/app/api/operator/sentinel/route.ts` - Cross-tenant sentinel flags (sentinel_flag + system/sentinel events)
- `apps/web/app/(operator)/layout.tsx` - Operator route group with requireOperator() gate and minimal header
- `apps/web/app/(operator)/operator/page.tsx` - Dashboard page with stats, health cards, active runs table
- `apps/web/app/(operator)/operator/sentinel/page.tsx` - Sentinel flags page with count badge
- `apps/web/components/operator/health-cards.tsx` - 4-service health grid with status dots and latency
- `apps/web/components/operator/active-runs-table.tsx` - Cross-tenant runs table with status badges
- `apps/web/components/operator/sentinel-flags-table.tsx` - Sortable sentinel flags table with severity badges
- `apps/web/lib/operator.ts` - Added requireOperatorApi() for API route contexts

## Decisions Made
- Added requireOperatorApi() that returns null instead of calling redirect() -- Next.js redirect() throws a special error that doesn't work well in API route try/catch blocks
- Cross-tenant queries iterate tenants sequentially with try/catch per schema -- acceptable at Year-1 scale (<10 tenants)
- Client-side sorting for sentinel table since data is already capped at 200 rows server-side

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added requireOperatorApi() for API routes**
- **Found during:** Task 1
- **Issue:** requireOperator() uses redirect() from next/navigation which throws NEXT_REDIRECT errors incompatible with API route try/catch patterns
- **Fix:** Added requireOperatorApi() that returns null instead of redirecting, allowing API routes to return proper 403 responses
- **Files modified:** apps/web/lib/operator.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** d03d081 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correct API route auth gating. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Operator dashboard fully functional, ready for Plan 03 (break-glass flow)
- Health cards will show real status once services are running
- Sentinel flags will populate once Sam produces sentinel_flag events

---
*Phase: 09-operator-console-sentinel*
*Completed: 2026-04-21*
