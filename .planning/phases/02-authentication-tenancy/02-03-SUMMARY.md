---
phase: 02-authentication-tenancy
plan: 03
subsystem: auth
tags: [better-auth, mfa, totp, qrcode, invite-flow, tenant-provisioning, organizations]

# Dependency graph
requires:
  - phase: 02-authentication-tenancy
    plan: 01
    provides: Better Auth server + client instances, auth schema tables, API route handler, email utility
  - phase: 02-authentication-tenancy
    plan: 02
    provides: Login page, middleware, requireTenantContext(), getTenantDb()
provides:
  - MFA setup page with QR code generation + backup codes + TOTP verification
  - MFA challenge page for login with backup code fallback
  - Accept-invite flow with server-side account creation bypassing disableSignUp
  - Signup page with invite-only informational message
  - provisionTenantWithAuth() extending provisionTenant with Better Auth org + admin user + sign-in verification
  - Integration tests for provisioning and sign-in verification
affects: [tenant-provisioning-scripts, admin-ui, onboarding-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [Server-side auth.api.signUpEmail to bypass disableSignUp, direct DB insert for org/member in provisioning, sign-in verification after provisioning]

key-files:
  created:
    - apps/web/app/(auth)/mfa-setup/page.tsx
    - apps/web/app/(auth)/mfa-challenge/page.tsx
    - apps/web/app/(auth)/signup/page.tsx
    - apps/web/app/(auth)/accept-invite/[id]/page.tsx
    - apps/web/app/api/accept-invite/route.ts
    - packages/db/src/__tests__/provision-auth.test.ts
  modified:
    - packages/db/src/provision-tenant.ts
    - packages/db/src/index.ts
    - apps/web/middleware.ts

key-decisions:
  - "Server-side auth.api.signUpEmail used to bypass disableSignUp for both invite acceptance and provisioning (Assumption A1)"
  - "Direct DB insert for organizations/members in provisioning script because createOrganization requires auth headers unavailable in CLI context (Assumption A4)"
  - "Middleware updated to allow /api/accept-invite as public route for unauthenticated invite acceptance"

patterns-established:
  - "Invite acceptance: client page fetches invitation, submits to API route, API does server-side signup + signin + accept + setActiveOrg"
  - "Provisioning: authInstance passed as parameter to avoid circular cross-package imports"
  - "MFA setup: 3-step flow (password confirm -> QR + backup codes -> TOTP verify)"

requirements-completed: [AUTH-03, AUTH-05, AUTH-07]

# Metrics
duration: 6min
completed: 2026-04-21
---

# Phase 2 Plan 03: MFA Pages, Invite Acceptance Flow, Extended Tenant Provisioning Summary

**TOTP MFA setup/challenge pages with QR codes and backup codes, invite-only signup flow with server-side account creation bypassing disableSignUp, and provisionTenantWithAuth with org/user creation and sign-in verification**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-21T16:56:20Z
- **Completed:** 2026-04-21T17:02:20Z
- **Tasks:** 2/2
- **Files modified:** 9

## Accomplishments
- MFA setup page with 3-step flow: password confirmation, QR code + backup codes display, TOTP verification -- all using Better Auth twoFactor client
- MFA challenge page with 6-digit TOTP input, trustDevice option, and backup code fallback toggle
- Complete invite acceptance flow: client validates invitation, signup form posts to API route which creates user server-side (bypassing disableSignUp), signs in, accepts invitation, and sets active organization explicitly
- provisionTenantWithAuth creates tenant + org (ID=tenant ID per D-01) + admin user via auth.api.signUpEmail + owner membership, with sign-in verification confirming the provisioned user can authenticate
- Unit tests covering provisioning flow, sign-in verification, and error cases (4 passing, 1 integration test skipped without DB)

## Task Commits

Each task was committed atomically:

1. **Task 1: MFA setup page + MFA challenge page + invite acceptance flow** - `2b16fc6` (feat)
2. **Task 2: Extended tenant provisioning with Better Auth API + sign-in verification** - `52443ed` (feat)

## Files Created/Modified
- `apps/web/app/(auth)/mfa-setup/page.tsx` - MFA enable flow: password -> QR code + backup codes -> TOTP verify
- `apps/web/app/(auth)/mfa-challenge/page.tsx` - TOTP verification on login with backup code fallback
- `apps/web/app/(auth)/signup/page.tsx` - Invite-only informational page with link to login
- `apps/web/app/(auth)/accept-invite/[id]/page.tsx` - Invitation validation + signup form for invited users
- `apps/web/app/api/accept-invite/route.ts` - Server-side invite acceptance: signUpEmail, signInEmail, acceptInvitation, setActiveOrganization
- `packages/db/src/provision-tenant.ts` - Added provisionTenantWithAuth with org creation, admin user, owner membership, sign-in verification
- `packages/db/src/index.ts` - Exports provisionTenantWithAuth and ProvisionTenantWithAuthInput type
- `packages/db/src/__tests__/provision-auth.test.ts` - Unit tests for provisioning + sign-in verification + error cases
- `apps/web/middleware.ts` - Added /api/accept-invite to public API routes

## Decisions Made
- Used auth.api.signUpEmail server-side to bypass disableSignUp (Assumption A1 from research) -- this is the community-recommended pattern for invite-only systems
- Used direct Drizzle inserts for organizations and members tables in provisioning script because auth.api.createOrganization requires authenticated request headers unavailable in CLI context (Assumption A4)
- authInstance passed as parameter to provisionTenantWithAuth to avoid circular import between packages/db and apps/web
- Added /api/accept-invite as a public route in middleware since the user is unauthenticated at the time of invite acceptance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added /api/accept-invite to middleware public routes**
- **Found during:** Task 1 (accept-invite API route creation)
- **Issue:** The plan did not explicitly mention updating middleware.ts, but the /api/accept-invite route must be publicly accessible since users are unauthenticated when accepting an invitation
- **Fix:** Added `/api/accept-invite` to the middleware public API paths check
- **Files modified:** apps/web/middleware.ts
- **Verification:** Build succeeds, route accessible without session
- **Committed in:** 2b16fc6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for invite acceptance to work without authentication. No scope creep.

## Issues Encountered
- Better Auth runtime warnings about BETTER_AUTH_SECRET and BETTER_AUTH_URL during build -- expected, these are runtime env vars. Build succeeds despite warnings.

## User Setup Required

None beyond what was documented in Plan 01 (BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL env vars).

## Next Phase Readiness
- Phase 02 authentication and tenancy is now complete: auth infrastructure (Plan 01), UI + middleware (Plan 02), MFA + invite flow + provisioning (Plan 03)
- All auth pages functional: login, signup (invite-only), MFA setup, MFA challenge, accept-invite, no-org
- Tenant provisioning creates org + admin user with sign-in verification
- Ready for Phase 03 (next milestone work)

## Self-Check: PASSED

All created files verified on disk. Both task commits (2b16fc6, 52443ed) verified in git log.

---
*Phase: 02-authentication-tenancy*
*Completed: 2026-04-21*
