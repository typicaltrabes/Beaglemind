---
phase: 10-mobile-pwa
plan: 02
subsystem: pwa
tags: [serwist, service-worker, web-push, vapid, pwa, manifest, push-notifications]

# Dependency graph
requires:
  - phase: 10-mobile-pwa
    provides: Responsive mobile layout with hamburger sidebar and sticky composer
provides:
  - Installable PWA with manifest.json and Serwist service worker
  - Push notification infrastructure (subscription storage, API, Hub trigger)
  - PushPermission mobile component for notification opt-in
affects: [10-mobile-pwa]

# Tech tracking
tech-stack:
  added: ["@serwist/next", "serwist", "web-push"]
  patterns: [Serwist service worker with push handler, VAPID-based web push, non-blocking push triggers]

key-files:
  created:
    - apps/web/public/manifest.json
    - apps/web/app/sw.ts
    - apps/web/public/icons/icon-192.png
    - apps/web/public/icons/icon-512.png
    - apps/web/app/api/push/subscribe/route.ts
    - apps/web/lib/push-client.ts
    - apps/web/components/push-permission.tsx
    - apps/agent-hub/src/notifications/push-service.ts
  modified:
    - apps/web/next.config.ts
    - apps/web/app/layout.tsx
    - apps/web/tsconfig.json
    - apps/web/app/(dashboard)/dashboard-shell.tsx
    - packages/db/src/schema/shared.ts
    - apps/agent-hub/src/handlers/message-router.ts
    - apps/agent-hub/package.json
    - apps/web/package.json

key-decisions:
  - "Excluded sw.ts from main tsconfig (WebWorker types conflict with DOM lib) -- Serwist builds it separately"
  - "No FK on pushSubscriptions.userId to avoid circular import between shared.ts and auth-schema.ts"
  - "Push trigger in MessageRouter.persistAndPublish (fire-and-forget with catch) so push failures never break event pipeline"
  - "Gold circle on dark background as placeholder icons -- replace with proper Beagle icon later"

patterns-established:
  - "Non-blocking push pattern: .catch() on triggerPushNotification so governance pipeline is never blocked"
  - "Push subscription upsert via onConflictDoNothing for idempotent re-subscription"

requirements-completed: [MOBI-02, MOBI-03]

# Metrics
duration: 6min
completed: 2026-04-21
---

# Phase 10 Plan 02: PWA Manifest, Service Worker, and Push Notifications Summary

**Installable PWA via Serwist with Web Push notifications for plan approval and question events triggered from Hub**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-21T19:58:40Z
- **Completed:** 2026-04-21T20:04:35Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- PWA manifest with standalone display, gold theme color, and placeholder icons for installability
- Serwist service worker with app shell caching, push event handler, and notificationclick deep-linking to run pages
- Full push subscription flow: client-side subscribeToPush, server-side storage in shared.push_subscriptions, Zod validation
- Hub push-service triggers web push on plan_proposal and question events with 410 stale cleanup
- PushPermission mobile banner in DashboardShell for notification opt-in

## Task Commits

Each task was committed atomically:

1. **Task 1: PWA manifest, service worker via Serwist, and icons** - `96cd699` (feat)
2. **Task 2: Push subscription storage, API routes, and Hub notification trigger** - `2d50fdc` (feat)

## Files Created/Modified
- `apps/web/public/manifest.json` - PWA manifest with name, icons, standalone display, gold theme
- `apps/web/app/sw.ts` - Serwist service worker with push + notificationclick handlers
- `apps/web/public/icons/icon-192.png` - 192x192 placeholder icon (gold circle on dark)
- `apps/web/public/icons/icon-512.png` - 512x512 placeholder icon (gold circle on dark)
- `apps/web/next.config.ts` - Wrapped with withSerwist for service worker build
- `apps/web/app/layout.tsx` - Added manifest link, theme-color, apple-mobile-web-app-capable meta
- `apps/web/tsconfig.json` - Excluded sw.ts (WebWorker lib conflicts with DOM)
- `packages/db/src/schema/shared.ts` - Added push_subscriptions table with unique (userId, endpoint) index
- `apps/web/app/api/push/subscribe/route.ts` - POST endpoint with auth + Zod validation, upserts subscription
- `apps/web/lib/push-client.ts` - Client push utilities: subscribeToPush, isPushSupported, isSubscribed
- `apps/web/components/push-permission.tsx` - Mobile-only notification opt-in banner
- `apps/web/app/(dashboard)/dashboard-shell.tsx` - Mounted PushPermission component after header
- `apps/agent-hub/src/notifications/push-service.ts` - Web Push sender with VAPID config and 410 cleanup
- `apps/agent-hub/src/handlers/message-router.ts` - Push notification trigger on plan_proposal/question events

## Decisions Made
- Excluded sw.ts from main tsconfig because WebWorker types conflict with DOM lib -- Serwist compiles it separately via withSerwist
- Avoided circular import by not adding FK reference from pushSubscriptions.userId to users.id (shared.ts cannot import auth-schema.ts)
- Push notifications fire-and-forget from MessageRouter.persistAndPublish with .catch() so governance event pipeline is never disrupted
- Used gold circle on dark background as placeholder icons -- functional for installability, can be replaced with proper branding

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded sw.ts from main tsconfig**
- **Found during:** Task 1
- **Issue:** Service worker file uses WebWorker types (ServiceWorkerGlobalScope, PushEvent) that conflict with DOM lib in main tsconfig
- **Fix:** Added `app/sw.ts` to tsconfig exclude array and added `/// <reference lib="webworker" />` directive
- **Files modified:** apps/web/tsconfig.json, apps/web/app/sw.ts
- **Committed in:** 96cd699

**2. [Rule 3 - Blocking] Avoided circular import in shared schema**
- **Found during:** Task 2
- **Issue:** Plan specified `references(() => users.id)` on pushSubscriptions.userId, but shared.ts is imported by auth-schema.ts creating a circular dependency
- **Fix:** Removed FK reference, kept userId as plain text column with comment documenting the relationship
- **Files modified:** packages/db/src/schema/shared.ts
- **Committed in:** 2d50fdc

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed blocking issues above.

## User Setup Required

VAPID keys must be generated and set as environment variables before push notifications work:

```bash
npx web-push generate-vapid-keys
```

**Environment variables needed:**
- `VAPID_PUBLIC_KEY` -- Hub + Web (also as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for client)
- `VAPID_PRIVATE_KEY` -- Hub only
- `VAPID_SUBJECT` -- Hub only (defaults to mailto:traber.luca@gmail.com)

The push_subscriptions table must be created via migration before subscriptions can be stored.

## Next Phase Readiness
- PWA installable and push notification infrastructure complete
- Ready for mobile question queue and overnight digest (plan 03)
- VAPID key generation is a one-time setup step that does not block development

---
*Phase: 10-mobile-pwa*
*Completed: 2026-04-21*
