---
phase: 08-replay-sharing
plan: 01
subsystem: api, database, ui
tags: [share-links, crypto, drizzle, dialog, clipboard]

requires:
  - phase: 01-foundation
    provides: tenant schema, auth, drizzle setup
  - phase: 04-research-sprint-workflow
    provides: runs table, SSE events
provides:
  - share_links and replay_views tables in tenant schema
  - POST/GET/DELETE share link API endpoints
  - ShareDialog component with copy-to-clipboard
  - Share Replay button on completed runs
affects: [08-02 replay-viewer, 08-03 link-management]

tech-stack:
  added: [node:crypto randomBytes]
  patterns: [tokenized-share-links, revocable-links]

key-files:
  created:
    - apps/web/app/api/share-links/route.ts
    - apps/web/app/api/share-links/[id]/route.ts
    - apps/web/components/share/share-dialog.tsx
  modified:
    - packages/db/src/schema/tenant.ts
    - apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx

key-decisions:
  - "Used visual copied state on button instead of toast library (no sonner/toast in project)"
  - "Non-null assertion on insert returning row (drizzle returning() always returns inserted rows)"

patterns-established:
  - "Share link token pattern: 32-byte hex via crypto.randomBytes, unique index on token column"
  - "Revocation via soft-delete (revokedAt timestamp) rather than hard delete"

requirements-completed: [REPL-01, REPL-02, REPL-03]

duration: 3min
completed: 2026-04-21
---

# Phase 8 Plan 01: Share Links Schema, API, and Dialog Summary

**Tenant-scoped share_links/replay_views tables with tokenized URL generation API and ShareDialog on completed runs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T19:27:05Z
- **Completed:** 2026-04-21T19:30:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- share_links table with 32-byte hex token, 30-day default expiry, unique index on token
- replay_views table for audit logging of external views
- POST /api/share-links creates tokenized share link, GET lists all, DELETE revokes by setting revokedAt
- ShareDialog component generates link on open, provides copy-to-clipboard with visual confirmation
- Share Replay button appears only on completed runs in the run page header

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema extension and share link API** - `1d5be6a` (feat)
2. **Task 2: Share dialog component and run page integration** - `238e572` (feat)

## Files Created/Modified
- `packages/db/src/schema/tenant.ts` - Added shareLinks and replayViews tables to createTenantSchema
- `apps/web/app/api/share-links/route.ts` - POST (create) and GET (list) share link endpoints
- `apps/web/app/api/share-links/[id]/route.ts` - DELETE (revoke) share link endpoint
- `apps/web/components/share/share-dialog.tsx` - Client dialog with link generation, copy, expiry display
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` - Added Share Replay button and ShareDialog

## Decisions Made
- Used visual "Copied" state on the copy button instead of a toast notification since sonner/toast is not in the project dependencies
- Used non-null assertion on drizzle insert returning() result since it always returns the inserted row

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript error on destructured insert returning result (possibly undefined) -- fixed with explicit non-null assertion on rows[0]

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Share link tables and API ready for Plan 02 (replay viewer page at /replay/[token])
- replay_views table ready for view audit logging
- ShareDialog can be extended with link management features in Plan 03

## Self-Check: PASSED

All 5 files verified present. Both task commits (1d5be6a, 238e572) confirmed in git log.

---
*Phase: 08-replay-sharing*
*Completed: 2026-04-21*
