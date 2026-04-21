# Phase 2: Authentication & Tenancy - Validation

**Created:** 2026-04-21
**Phase:** 02-authentication-tenancy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (installed at root) |
| Quick run | `pnpm vitest run --reporter=verbose` |
| Full suite | `pnpm vitest run` |

## Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | Plan |
|--------|----------|-----------|-------------------|------|
| AUTH-01 | Invite-only signup creates user via server-side signUpEmail | integration | `pnpm vitest run apps/web/tests/auth/invite-signup.test.ts -x` | 02-03 |
| AUTH-02 | Session persists across requests (database sessions) | integration | `pnpm vitest run apps/web/tests/auth/session.test.ts -x` | 02-01 |
| AUTH-03 | MFA enable/verify TOTP flow | integration | `pnpm vitest run apps/web/tests/auth/mfa.test.ts -x` | 02-03 |
| AUTH-04 | Logout invalidates session | integration | `pnpm vitest run apps/web/tests/auth/logout.test.ts -x` | 02-02 |
| AUTH-05 | Admin invite sends email (or logs in dev) | unit | `pnpm vitest run apps/web/tests/auth/invite.test.ts -x` | 02-03 |
| AUTH-06 | Tenant isolation: middleware cookie check + server-side requireTenantContext | integration | `pnpm vitest run apps/web/tests/auth/tenant-isolation.test.ts -x` | 02-02 |
| AUTH-07 | Provisioning creates schema + org + admin user who can sign in | integration | `pnpm vitest run packages/db/src/__tests__/provision-auth.test.ts -x` | 02-03 |
| AUTH-08 | Organization = tenant mapping via activeOrganizationId in session | integration | `pnpm vitest run apps/web/tests/auth/org-tenant.test.ts -x` | 02-02 |

## Wave 0 Test Gaps

These test files do not exist yet and should be created during plan execution:

| File | Created By | Notes |
|------|-----------|-------|
| `packages/db/src/__tests__/provision-auth.test.ts` | Plan 02-03, Task 2 | Requires running PostgreSQL |
| `apps/web/tests/auth/invite-signup.test.ts` | Not yet assigned | Needs Better Auth test instance |
| `apps/web/tests/auth/session.test.ts` | Not yet assigned | Needs Better Auth test instance |
| `apps/web/tests/auth/mfa.test.ts` | Not yet assigned | Needs Better Auth test instance |
| `apps/web/tests/auth/logout.test.ts` | Not yet assigned | Needs Better Auth test instance |
| `apps/web/tests/auth/invite.test.ts` | Not yet assigned | Unit test for email utility |
| `apps/web/tests/auth/tenant-isolation.test.ts` | Not yet assigned | Needs two provisioned tenants |
| `apps/web/tests/auth/org-tenant.test.ts` | Not yet assigned | Needs Better Auth + org setup |

Note: Most `apps/web/tests/auth/` tests require a Better Auth test instance with database. These are integration tests best run with a test database. The primary automated verification during plan execution is `pnpm -r build` (type-checking) and the provision-auth tests in packages/db.

## Sampling Rate

- **Per task commit:** `pnpm -r build` (type-check pass)
- **Per plan completion:** `pnpm vitest run --reporter=verbose` (all existing tests)
- **Phase gate:** Full suite green + `pnpm vitest run packages/db/src/__tests__/provision-auth.test.ts` passes

## Key Verification Commands

```bash
# Build check (all plans)
pnpm -r build

# Auth schema tables in shared pgSchema (Plan 01)
grep -c "shared.table" packages/db/src/schema/auth-schema.ts  # expect 7

# Middleware is Edge-safe (Plan 02)
grep "getSessionCookie" apps/web/middleware.ts                  # expect match
grep -L "auth.api.getSession" apps/web/middleware.ts            # expect file listed (NOT present)
grep -L "x-tenant-id" apps/web/middleware.ts                    # expect file listed (NOT present)

# Server-side tenant resolution (Plan 02)
grep "activeOrganizationId" apps/web/lib/get-tenant.ts          # expect match
grep "auth.api.getSession" apps/web/lib/get-tenant.ts           # expect match

# Invite flow uses setActiveOrganization (Plan 03)
grep "setActiveOrganization" apps/web/app/api/accept-invite/route.ts  # expect match

# Provisioning uses auth API, not bcryptjs (Plan 03)
grep "signUpEmail" packages/db/src/provision-tenant.ts          # expect match
grep "signInEmail" packages/db/src/provision-tenant.ts          # expect match (verification step)
grep -rL "bcryptjs" packages/db/package.json                    # expect file listed (NOT present)

# Provisioning + isolation tests (Plan 03)
pnpm vitest run packages/db/src/__tests__/provision-auth.test.ts --reporter=verbose
```
