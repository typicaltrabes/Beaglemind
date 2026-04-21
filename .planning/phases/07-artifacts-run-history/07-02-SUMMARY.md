---
phase: 07-artifacts-run-history
plan: 02
subsystem: ui
tags: [tanstack-query, drizzle, next.js, run-history, cost-tracking]

requires:
  - phase: 04-research-sprint-workflow
    provides: runs table, events table with costUsd metadata, sidebar navigation
  - phase: 06-clean-studio-modes
    provides: DashboardShell layout, dark theme conventions
provides:
  - Run history API route with tenant-scoped filtering and pagination
  - Run history page at /runs with search, status filters, cost badges
  - RunCostBadge reusable component with color-coded thresholds
  - useRunHistory TanStack Query hook
affects: [07-artifacts-run-history]

tech-stack:
  added: []
  patterns: [color-coded cost badge thresholds, server-side subquery aggregation for cost/artifact count]

key-files:
  created:
    - apps/web/app/api/runs/history/route.ts
    - apps/web/lib/hooks/use-run-history.ts
    - apps/web/components/runs/run-cost-badge.tsx
    - apps/web/components/runs/run-history-table.tsx
    - apps/web/app/(dashboard)/runs/page.tsx
  modified:
    - apps/web/components/sidebar/sidebar.tsx

key-decisions:
  - "Drizzle SQL subqueries for artifact count and cost aggregation inline in SELECT"
  - "Status whitelist validation to prevent injection via query params"
  - "Debounced search with 300ms delay and pagination reset on filter change"

patterns-established:
  - "RunCostBadge: green < $5, yellow $5-20, red > $20 with -- for zero cost"
  - "Run history API: parameterized ILIKE search, max limit 100 enforced server-side"

requirements-completed: [ARTF-04, ARTF-05]

duration: 3min
completed: 2026-04-21
---

# Phase 7 Plan 2: Run History Page Summary

**Run history page at /runs with tenant-scoped API, status/search filters, color-coded cost badges, and clickable row navigation to Writers Room**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T19:19:36Z
- **Completed:** 2026-04-21T19:22:19Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- GET /api/runs/history API with joined project name, artifact count, cost aggregation, status/search filters, and pagination (limit capped at 100 per T-07-06)
- Run history page with debounced search, multi-select status toggle filters, and load-more pagination
- Color-coded RunCostBadge component (green/yellow/red thresholds per D-12)
- Sidebar Run History navigation link with History icon

## Task Commits

Each task was committed atomically:

1. **Task 1: Run history API route + query hook + sidebar nav link** - `f14bc3f` (feat)
2. **Task 2: Run history page with table, filters, search, and cost badge** - `7280a6b` (feat)

## Files Created/Modified
- `apps/web/app/api/runs/history/route.ts` - GET endpoint with tenant-scoped run history, joins, subqueries for cost/artifacts
- `apps/web/lib/hooks/use-run-history.ts` - TanStack Query hook with typed RunHistoryItem and filter params
- `apps/web/components/runs/run-cost-badge.tsx` - Color-coded cost display component
- `apps/web/components/runs/run-history-table.tsx` - Table with all columns per D-09, skeleton loading, clickable rows
- `apps/web/app/(dashboard)/runs/page.tsx` - Run history page with search, status filters, pagination
- `apps/web/components/sidebar/sidebar.tsx` - Added Run History nav link with History icon

## Decisions Made
- Used Drizzle SQL template subqueries for artifact count and cost aggregation inline in the SELECT statement rather than separate queries
- Status filter values validated against a whitelist Set before use in query (per T-07-05)
- Max limit enforced at 100 server-side regardless of client request (per T-07-06)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Run history page complete and navigable from sidebar
- Cost badge component reusable for other views
- Ready for remaining Phase 7 plans (artifact preview, bucket isolation)

## Self-Check: PASSED

All 7 files verified present. Both task commits (f14bc3f, 7280a6b) found in git log.

---
*Phase: 07-artifacts-run-history*
*Completed: 2026-04-21*
