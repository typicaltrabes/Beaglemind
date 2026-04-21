---
phase: 08-replay-sharing
plan: 02
subsystem: api, ui
tags: [replay, public-page, clean-mode, server-side-filtering, read-only-transcript]

requires:
  - phase: 08-replay-sharing
    provides: share_links and replay_views tables, share link API
  - phase: 05-transcript-ui
    provides: MessageList, scene grouping, collapse folds, agent components
provides:
  - Public replay events API with server-side Clean-mode filtering
  - Public replay page at /replay/[token] with read-only transcript
  - ReplayMessageList component (prop-driven, no Zustand dependency)
affects: [08-03 link-management]

tech-stack:
  added: []
  patterns: [tenant-iteration-token-lookup, read-only-component-variants, prop-driven-message-list]

key-files:
  created:
    - apps/web/app/api/replay/[token]/events/route.ts
    - apps/web/app/replay/[token]/page.tsx
    - apps/web/app/replay/[token]/layout.tsx
    - apps/web/components/replay/replay-message-list.tsx
  modified: []

key-decisions:
  - "Tenant iteration for token lookup (O(tenants)) instead of public lookup table -- simpler, sufficient for Year 1"
  - "Read-only plan/question cards inlined in ReplayMessageList instead of adding readOnly prop to originals -- avoids coupling replay concerns into dashboard components"
  - "ReadOnlyCollapseFold defaults to collapsed (no ModeProvider dependency) instead of reusing CollapseFold which depends on useMode"

patterns-established:
  - "Public route pattern: /replay/[token] outside (dashboard) group, no auth middleware, minimal layout"
  - "Server-side content filtering: CLEAN_EVENT_TYPES constant + metadata stripping before response"
  - "Fire-and-forget view logging: non-awaited insert for audit trail without response latency"

requirements-completed: [REPL-04, REPL-05, REPL-06]

duration: 3min
completed: 2026-04-21
---

# Phase 8 Plan 02: Public Replay Page and Filtered Events API Summary

**Server-side Clean-mode filtered events API with public read-only replay page at /replay/[token] for unauthenticated external viewers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T19:32:31Z
- **Completed:** 2026-04-21T19:35:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Public events API filters to CLEAN_EVENT_TYPES at SQL level and strips sentinel/cost/fork metadata before response
- Token lookup iterates tenant schemas (O(tenants), acceptable for Year 1 low-tenant deployment)
- Expired/revoked links return 410 with descriptive messages; invalid tokens return 404
- Every replay view logged to replay_views with IP, user-agent, timestamp (fire-and-forget)
- Read-only replay page with scene grouping, collapse folds, TLDR banner, and no interactive elements
- Minimal layout with "Powered by Beagle Agent Console" footer, no auth/sidebar/ModeProvider

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side filtered replay events API with view logging** - `8a89b27` (feat)
2. **Task 2: Public replay page with read-only transcript** - `50ff25a` (feat)

## Files Created/Modified
- `apps/web/app/api/replay/[token]/events/route.ts` - Public API: token lookup, Clean-mode filter, metadata stripping, view logging
- `apps/web/app/replay/[token]/layout.tsx` - Minimal layout outside dashboard: header, footer, no auth
- `apps/web/app/replay/[token]/page.tsx` - Client page: fetch events, render read-only transcript with error states
- `apps/web/components/replay/replay-message-list.tsx` - Prop-driven read-only MessageList with inlined plan/question cards

## Decisions Made
- Tenant iteration for token lookup instead of public lookup table -- keeps schema simple, O(tenants) is fine for Year 1
- Inlined read-only plan/question cards in ReplayMessageList rather than adding readOnly props to dashboard components -- keeps replay concerns decoupled
- ReadOnlyCollapseFold defaults to collapsed (no ModeProvider) -- external viewers don't have Clean/Studio mode concept

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Replay page fully functional for Plan 03 (link management page to view/revoke links)
- replay_views table populated for admin audit log display
- ReplayMessageList can be extended with additional replay-specific features if needed

## Self-Check: PASSED

All 4 files verified present. Both task commits (8a89b27, 50ff25a) confirmed in git log.

---
*Phase: 08-replay-sharing*
*Completed: 2026-04-21*
