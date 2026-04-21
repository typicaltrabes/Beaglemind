---
phase: 04-research-sprint-workflow
plan: 03
subsystem: api
tags: [next-js-api-routes, sse, redis, drizzle, zod, s3-presigned-url, state-machine]

requires:
  - phase: 04-research-sprint-workflow
    provides: "6 domain tables in tenant schema, run state machine, Hub HTTP client (Plan 01); Hub /runs/approve and /runs/questions/answer routes (Plan 02)"

provides:
  - "POST/GET /api/projects for project CRUD"
  - "POST /api/runs to create run and start sprint via Hub"
  - "POST /api/runs/[id]/approve with state machine validation"
  - "POST /api/runs/[id]/stop with state machine validation"
  - "POST /api/runs/[id]/questions/[qid]/answer with ownership check"
  - "GET /api/runs/[id]/stream SSE endpoint with DB catch-up + Redis real-time"
  - "GET /api/artifacts/[id]/download presigned MinIO URL with 5-min expiry"

affects: [04-04, 04-05, 04-06]

tech-stack:
  added: ["drizzle-orm (direct dep in apps/web)", "@aws-sdk/client-s3 (direct dep in apps/web)", "@aws-sdk/s3-request-presigner (direct dep in apps/web)"]
  patterns:
    - "API route pattern: requireTenantContext() -> getTenantDb() -> Zod validate -> DB op -> Hub call -> NextResponse.json()"
    - "SSE pattern: ReadableStream with start() fire-and-forget, request.signal abort cleanup, Redis subscriber per connection"
    - "Artifact download: presigned URL via getSignedUrl + Response.redirect"

key-files:
  created:
    - apps/web/app/api/projects/route.ts
    - apps/web/app/api/runs/route.ts
    - apps/web/app/api/runs/[id]/approve/route.ts
    - apps/web/app/api/runs/[id]/stop/route.ts
    - apps/web/app/api/runs/[id]/questions/[qid]/answer/route.ts
    - apps/web/app/api/runs/[id]/stream/route.ts
    - apps/web/app/api/artifacts/[id]/download/route.ts
  modified:
    - apps/web/package.json

key-decisions:
  - "Added drizzle-orm as direct dep in apps/web for query operator imports (eq, desc, asc, gt, and)"
  - "Added @aws-sdk/client-s3 and s3-request-presigner as direct deps in apps/web for artifact download route"
  - "SSE uses dynamic import for ioredis to avoid bundling issues"

patterns-established:
  - "API route: runtime='nodejs', requireTenantContext(), getTenantDb(), Zod body parse, try/catch with typed error responses"
  - "SSE: ReadableStream start() with fire-and-forget replay(), Last-Event-ID reconnection, heartbeat 30s, abort cleanup"
  - "State-changing routes: assertTransition() before DB update, insert stateTransitions audit log"

requirements-completed: [WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, WORK-07, WORK-08, WORK-09]

duration: 3min
completed: 2026-04-21
---

# Phase 4 Plan 03: API Routes Summary

**7 Next.js API routes covering project CRUD, run lifecycle (create/approve/stop), question answering, SSE streaming with DB catch-up + Redis real-time, and presigned MinIO artifact download**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T18:07:37Z
- **Completed:** 2026-04-21T18:10:37Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Complete server-side API surface for research sprint workflow (7 route files)
- SSE endpoint with DB event replay, Redis real-time subscription, Last-Event-ID reconnection, 30s heartbeat, and abort cleanup
- All state-changing routes enforce state machine transitions via assertTransition() before DB updates
- All routes authenticated via requireTenantContext() with tenant-scoped DB queries

## Task Commits

Each task was committed atomically:

1. **Task 1: Projects + Runs + Approve + Stop + Answer API routes** - `9d839a8` (feat)
2. **Task 2: SSE streaming endpoint + artifact download route** - `4921499` (feat)

## Files Created/Modified
- `apps/web/app/api/projects/route.ts` - GET (list) + POST (create) for projects with Zod validation
- `apps/web/app/api/runs/route.ts` - POST to create run (pending) and call Hub startRun
- `apps/web/app/api/runs/[id]/approve/route.ts` - POST to approve plan, transition planned->approved->executing, call Hub
- `apps/web/app/api/runs/[id]/stop/route.ts` - POST to cancel run, validate transition, call Hub
- `apps/web/app/api/runs/[id]/questions/[qid]/answer/route.ts` - POST to answer question with ownership validation
- `apps/web/app/api/runs/[id]/stream/route.ts` - GET SSE with ReadableStream, DB catch-up, Redis real-time
- `apps/web/app/api/artifacts/[id]/download/route.ts` - GET presigned MinIO URL with 5-min expiry, 302 redirect
- `apps/web/package.json` - Added drizzle-orm, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner as direct deps

## Decisions Made
- Added drizzle-orm as direct dependency in apps/web (needed for query operator imports like `eq`, `desc`, `asc`, `gt`, `and`)
- Added @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner as direct deps in apps/web for artifact download route (rather than re-exporting through packages/db)
- SSE endpoint uses dynamic import for ioredis (`await import('ioredis')`) to avoid Next.js bundling issues with Node.js-only Redis client

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added drizzle-orm as direct dependency in apps/web**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** API routes import `eq`, `desc`, `asc` from `drizzle-orm` but it was only a transitive dep via @beagle-console/db
- **Fix:** `pnpm add drizzle-orm` in apps/web
- **Files modified:** apps/web/package.json
- **Verification:** TypeScript compiles clean
- **Committed in:** 9d839a8 (Task 1 commit)

**2. [Rule 3 - Blocking] Added @aws-sdk/client-s3 and s3-request-presigner to apps/web**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Artifact download route imports GetObjectCommand and getSignedUrl directly from AWS SDK packages, which were only installed in packages/db
- **Fix:** `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` in apps/web
- **Files modified:** apps/web/package.json
- **Verification:** TypeScript compiles clean
- **Committed in:** 4921499 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were missing direct dependencies required for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 API routes ready for frontend consumption (Plans 04-06)
- SSE endpoint ready for EventSource connection from browser
- Projects API ready for sidebar project list component
- Run lifecycle routes ready for plan approval card and stop button
- Question answer route ready for question queue UI

## Self-Check: PASSED

All 7 key files verified on disk. Both commits verified in git history.

---
*Phase: 04-research-sprint-workflow*
*Completed: 2026-04-21*
