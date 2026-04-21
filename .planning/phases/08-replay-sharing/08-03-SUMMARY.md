---
phase: 08-replay-sharing
plan: 03
subsystem: ui, api
tags: [share-links, management, audit-log, revocation, sidebar-nav]

requires:
  - phase: 08-replay-sharing
    provides: share_links and replay_views tables, share link CRUD API, replay page
provides:
  - Shared links management page at /shared-links
  - Audit log API endpoint for replay views
  - Revocation UI with optimistic updates
  - Sidebar navigation to shared links
affects: []

tech-stack:
  added: []
  patterns: [expandable-table-row, optimistic-revocation]

key-files:
  created:
    - apps/web/app/api/share-links/[id]/views/route.ts
    - apps/web/components/share/shared-links-table.tsx
    - apps/web/components/share/replay-audit-log.tsx
    - apps/web/app/(dashboard)/shared-links/page.tsx
  modified:
    - apps/web/components/sidebar/sidebar.tsx

key-decisions:
  - "Expandable table row for audit log instead of separate page or dialog -- keeps context inline"
  - "Optimistic revocation with revert on failure for responsive UX"

patterns-established:
  - "Expandable table row pattern: colSpan cell with conditional render below data row"

requirements-completed: [REPL-02, REPL-05]

duration: 2min
completed: 2026-04-21
---

# Phase 8 Plan 03: Shared Links Management with Revocation and Audit Log Summary

**Tenant admin management page listing all share links with status badges, inline revocation, and expandable replay view audit logs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-21T19:37:31Z
- **Completed:** 2026-04-21T19:39:09Z
- **Tasks:** 1 (+ 1 human-verify checkpoint pending)
- **Files modified:** 5

## Accomplishments
- GET /api/share-links/[id]/views endpoint returns last 100 replay views with tenant ownership validation (T-08-10)
- SharedLinksTable displays all links with Active/Expired/Revoked status badges, relative timestamps, and inline actions
- Revoke action with confirmation dialog and optimistic UI update; reverted on server failure
- ReplayAuditLog expandable row showing viewer IP, user-agent, and formatted timestamp
- Sidebar navigation updated with Share2 icon link to /shared-links

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit log API and shared links management page** - `424314a` (feat)

## Files Created/Modified
- `apps/web/app/api/share-links/[id]/views/route.ts` - GET endpoint for replay view audit log per share link
- `apps/web/components/share/shared-links-table.tsx` - Client table with status badges, revoke, expandable audit log
- `apps/web/components/share/replay-audit-log.tsx` - Client component displaying replay view entries
- `apps/web/app/(dashboard)/shared-links/page.tsx` - Dashboard page rendering SharedLinksTable
- `apps/web/components/sidebar/sidebar.tsx` - Added Shared Links nav item with Share2 icon

## Decisions Made
- Used expandable table row (colSpan + conditional render) for audit log instead of dialog/sheet -- keeps context inline and avoids additional dependency
- Optimistic revocation: immediately updates revokedAt in local state, reverts by re-fetching on server error

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete replay sharing system built across Plans 01-03
- Share link generation, public replay viewing, and admin management all functional
- Phase 08 ready for verification

## Self-Check: PASSED

All 4 created files verified present. Task commit (424314a) confirmed in git log.
