---
phase: 09-operator-console-sentinel
plan: 03
subsystem: api, ui, auth
tags: [break-glass, audit-log, operator, time-boxed-access, drizzle]

requires:
  - phase: 09-operator-console-sentinel
    provides: requireOperator utility, breakGlassAudit table, isOperator flag

provides:
  - Break-glass API (POST create session, GET list active sessions)
  - Tenant data viewer endpoints during active break-glass window
  - Customer-facing audit log API and page
  - Break-glass request UI with tenant dropdown and run viewer

affects: [operator-dashboard, tenant-admin]

tech-stack:
  added: []
  patterns: [break-glass time-boxed access with server-side 4hr expiry, tenant-scoped audit records visible to org owners]

key-files:
  created:
    - apps/web/app/api/operator/break-glass/route.ts
    - apps/web/app/api/operator/break-glass/[tenantId]/runs/route.ts
    - apps/web/app/api/operator/break-glass/[tenantId]/runs/[runId]/route.ts
    - apps/web/app/(operator)/operator/break-glass/page.tsx
    - apps/web/app/(operator)/operator/layout.tsx
    - apps/web/components/operator/break-glass-form.tsx
    - apps/web/components/operator/break-glass-run-viewer.tsx
    - apps/web/app/api/audit-log/route.ts
    - apps/web/app/(dashboard)/audit-log/page.tsx
    - apps/web/components/audit/audit-log-table.tsx
    - apps/web/app/api/operator/tenants/route.ts
  modified:
    - apps/web/components/sidebar/sidebar.tsx

key-decisions:
  - "Operator layout created as part of this plan since 09-02 not yet executed (Rule 3 blocking)"
  - "Tenant list endpoint /api/operator/tenants added for break-glass form dropdown (Rule 2)"
  - "Sidebar audit log link uses Better Auth orgClient.getActiveMember() for owner role check"
  - "No-cache headers on break-glass data endpoints per T-09-09"

patterns-established:
  - "Break-glass session check: query breakGlassAudit WHERE operatorId=user AND expiresAt>now AND revokedAt IS NULL"
  - "Audit log role gate: members table role check for owner/admin before returning records"

requirements-completed: [OPER-05, OPER-06]

duration: 4min
completed: 2026-04-21
---

# Phase 9 Plan 03: Break-Glass Access Flow Summary

**Break-glass time-boxed access with 4hr server-enforced expiry, operator run viewer, and customer-visible audit log**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T19:47:03Z
- **Completed:** 2026-04-21T19:51:48Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Break-glass API with POST (create 4hr session) and GET (list active sessions) endpoints
- Tenant data viewer endpoints that enforce active break-glass session before returning runs/events
- Customer-facing audit log page showing operator access with email, reason, timestamps, and status badges
- Break-glass UI with request form, active session list with time remaining, and inline run viewer
- Sidebar audit log link visible only to org owners

## Task Commits

Each task was committed atomically:

1. **Task 1: Break-glass API routes and tenant data viewer endpoints** - `75cf3b5` (feat)
2. **Task 2: Break-glass UI, tenant audit log page, and sidebar link** - `b3e9fff` (feat)

## Files Created/Modified
- `apps/web/app/api/operator/break-glass/route.ts` - POST create session, GET list active sessions
- `apps/web/app/api/operator/break-glass/[tenantId]/runs/route.ts` - List tenant runs during active session
- `apps/web/app/api/operator/break-glass/[tenantId]/runs/[runId]/route.ts` - View run events during active session
- `apps/web/app/api/operator/tenants/route.ts` - List tenants for break-glass form dropdown
- `apps/web/app/(operator)/operator/layout.tsx` - Operator route group layout with requireOperator gate
- `apps/web/app/(operator)/operator/break-glass/page.tsx` - Break-glass request form and active sessions page
- `apps/web/components/operator/break-glass-form.tsx` - Tenant selector, reason input, submit form
- `apps/web/components/operator/break-glass-run-viewer.tsx` - Read-only run list and event transcript viewer
- `apps/web/app/api/audit-log/route.ts` - Tenant-scoped audit log API (owner/admin only)
- `apps/web/app/(dashboard)/audit-log/page.tsx` - Audit log page for tenant admins
- `apps/web/components/audit/audit-log-table.tsx` - Audit records table with status badges
- `apps/web/components/sidebar/sidebar.tsx` - Added audit log link for org owners

## Decisions Made
- Created operator layout (requireOperator gate + QueryProvider) since 09-02 hadn't created one yet -- Rule 3 blocking
- Added /api/operator/tenants endpoint for break-glass form tenant dropdown -- Rule 2 missing functionality
- Used Better Auth orgClient.getActiveMember() in sidebar for owner role check to conditionally show audit log link
- No-cache headers on all break-glass data endpoints to prevent stale cached tenant data access (T-09-09)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created operator route group layout**
- **Found during:** Task 2 (operator break-glass page)
- **Issue:** Operator route group (operator) had no layout.tsx -- page would render without auth gate
- **Fix:** Created apps/web/app/(operator)/operator/layout.tsx with requireOperator() and QueryProvider
- **Files modified:** apps/web/app/(operator)/operator/layout.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** b3e9fff (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added tenant list endpoint for break-glass form**
- **Found during:** Task 2 (break-glass form component)
- **Issue:** No existing endpoint to list tenants for the break-glass form dropdown
- **Fix:** Created GET /api/operator/tenants returning tenant id/name, gated by requireOperator()
- **Files modified:** apps/web/app/api/operator/tenants/route.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** b3e9fff (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both necessary for functionality. No scope creep.

## Threat Surface

All threat model mitigations implemented:
- T-09-07: requireOperator() + active session check on every data endpoint
- T-09-08: Immutable audit records in tenant schema with operatorId, reason, timestamps
- T-09-09: No-cache headers on data endpoints, 403 on expired sessions
- T-09-10: expiresAt set at creation, not modifiable via API

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Break-glass flow complete: request -> grant -> view -> expire
- Tenant admins can see operator access records at /audit-log
- Operator layout ready for 09-02 (operator dashboard) when it executes

## Self-Check: PASSED

All 12 created files verified present. Both task commits (75cf3b5, b3e9fff) verified in git log.

---
*Phase: 09-operator-console-sentinel*
*Completed: 2026-04-21*
