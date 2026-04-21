---
phase: 02-authentication-tenancy
plan: 01
subsystem: auth
tags: [better-auth, drizzle, organizations, 2fa, totp, resend, email, next-js]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: monorepo scaffold, packages/db with shared pgSchema and tenant utilities, apps/web Next.js 15.5 app
provides:
  - Auth schema with 7 tables (users, sessions, accounts, organizations, members, invitations, twoFactors) in shared pgSchema
  - Better Auth server instance with Organizations + 2FA plugins and Drizzle adapter
  - Better Auth client with signIn, signOut, useSession, orgClient, twoFactor exports
  - Catch-all API route handler at /api/auth/[...all]
  - Email utility with Resend transport and dev console.log fallback
affects: [02-02, 02-03, auth-ui, tenant-middleware, invite-flow]

# Tech tracking
tech-stack:
  added: [better-auth@1.6.5, resend@6.12.2, qrcode@1.5.4, zod@4.3.6]
  patterns: [Better Auth server config with plugins, auth client exports pattern, Resend email with dev fallback]

key-files:
  created:
    - packages/db/src/schema/auth-schema.ts
    - apps/web/lib/auth.ts
    - apps/web/lib/auth-client.ts
    - apps/web/lib/email.ts
    - apps/web/app/api/auth/[...all]/route.ts
  modified:
    - packages/db/src/index.ts
    - packages/db/package.json
    - apps/web/package.json
    - apps/web/tsconfig.json
    - packages/db/src/vault-resolver.ts
    - packages/db/src/provision-tenant.ts

key-decisions:
  - "Removed .js import extensions in packages/db for webpack/Next.js transpilePackages compatibility"
  - "Added zod as direct dependency in apps/web to satisfy Better Auth type inference requirements"
  - "Disabled declaration/declarationMap in web tsconfig to prevent non-portable type errors from Better Auth generics"
  - "Fixed tsconfig paths from multi-root to single ./* mapping for correct @/ alias resolution"

patterns-established:
  - "Auth schema tables: use shared.table() from shared pgSchema, text PKs, timestamp with timezone"
  - "Better Auth server: single instance in lib/auth.ts, imported by API route and server utilities"
  - "Auth client: individual named exports (signIn, signOut, etc.) rather than full client re-export to avoid type portability issues"
  - "Email utility: Resend with RESEND_API_KEY env check, console.log fallback in dev"

requirements-completed: [AUTH-02, AUTH-08]

# Metrics
duration: 6min
completed: 2026-04-21
---

# Phase 2 Plan 01: Better Auth Core Infrastructure Summary

**Better Auth server with Organizations + 2FA plugins, Drizzle adapter on shared pgSchema with 7 auth tables, client hooks, catch-all API route, and Resend email utility with dev fallback**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-21T16:41:21Z
- **Completed:** 2026-04-21T16:47:44Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments
- All 7 Better Auth tables (users, sessions, accounts, organizations, members, invitations, twoFactors) defined in shared pgSchema with proper foreign key references
- Better Auth server configured with Organizations plugin (invite-only, disableSignUp: true, allowUserToCreateOrganization: false) and 2FA plugin (TOTP 6-digit/30s, 10 backup codes)
- Client exports for signIn, signOut, useSession, orgClient, twoFactor ready for UI consumption
- API route handler live at /api/auth/[...all] for GET and POST
- Email utility sends via Resend in production, logs to console in dev (no RESEND_API_KEY)

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth schema tables in shared pgSchema + install dependencies** - `c004450` (feat)
2. **Task 2: Better Auth server + client + API route + email utility** - `51b3d23` (feat)

## Files Created/Modified
- `packages/db/src/schema/auth-schema.ts` - 7 auth tables in shared pgSchema (users, sessions, accounts, organizations, members, invitations, twoFactors)
- `apps/web/lib/auth.ts` - Better Auth server with Organizations + 2FA + Drizzle adapter + nextCookies
- `apps/web/lib/auth-client.ts` - Client hooks: signIn, signOut, useSession, orgClient, twoFactor
- `apps/web/lib/email.ts` - Resend email utility with dev console.log fallback
- `apps/web/app/api/auth/[...all]/route.ts` - Catch-all auth API route handler
- `packages/db/src/index.ts` - Added auth-schema export, removed .js extensions
- `packages/db/package.json` - Added subpath export for ./schema/auth-schema
- `apps/web/package.json` - Added better-auth, resend, qrcode, zod dependencies
- `apps/web/tsconfig.json` - Fixed @/* paths, disabled declaration emit
- `packages/db/src/vault-resolver.ts` - Removed .js import extension
- `packages/db/src/provision-tenant.ts` - Removed .js import extensions

## Decisions Made
- Removed .js import extensions across packages/db source files -- webpack in Next.js transpilePackages mode cannot resolve .js to .ts files, and moduleResolution: "bundler" works without extensions
- Added zod@4.3.6 as direct dependency in apps/web -- Better Auth's types reference zod internals; without it as a direct dep, TypeScript cannot resolve the type during build
- Set declaration: false and declarationMap: false in apps/web tsconfig -- the inherited declaration: true from base tsconfig caused "type cannot be named" errors for Better Auth's complex generic types. Since apps/web uses noEmit: true (it is an app, not a library), declaration emit is not needed
- Fixed tsconfig paths from multi-root array to single "./*" -- the original `["./app/*", "./components/*", "./lib/*"]` mapping was incorrect and would not resolve `@/lib/auth` properly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tsconfig @/* path alias mapping**
- **Found during:** Task 1 (pre-execution code review)
- **Issue:** tsconfig paths `@/*` mapped to `["./app/*", "./components/*", "./lib/*"]` which would never resolve `@/lib/auth` correctly (it would try `./app/lib/auth`, `./components/lib/auth`, `./lib/lib/auth`)
- **Fix:** Changed to standard `"@/*": ["./*"]` so `@/lib/auth` resolves to `./lib/auth`
- **Files modified:** apps/web/tsconfig.json
- **Verification:** Build succeeds with correct imports
- **Committed in:** c004450 (Task 1 commit)

**2. [Rule 3 - Blocking] Removed .js import extensions in packages/db for webpack compatibility**
- **Found during:** Task 2 (build verification)
- **Issue:** packages/db/src/index.ts used `.js` extensions in imports (ESM convention). When Next.js transpiles the package via transpilePackages, webpack cannot resolve `.js` to `.ts` files, causing "Module not found" errors for all db package imports
- **Fix:** Removed `.js` extensions from all internal imports in packages/db source files
- **Files modified:** packages/db/src/index.ts, packages/db/src/schema/auth-schema.ts, packages/db/src/vault-resolver.ts, packages/db/src/provision-tenant.ts
- **Verification:** `pnpm -r build` succeeds
- **Committed in:** 51b3d23 (Task 2 commit)

**3. [Rule 3 - Blocking] Added zod as direct dependency for type resolution**
- **Found during:** Task 2 (build verification)
- **Issue:** TypeScript could not infer auth client types because zod (transitive dep of better-auth) was not directly accessible, causing "inferred type cannot be named" errors
- **Fix:** Added zod@4.3.6 as direct dependency in apps/web
- **Files modified:** apps/web/package.json
- **Verification:** Type error about zod resolved
- **Committed in:** 51b3d23 (Task 2 commit)

**4. [Rule 3 - Blocking] Disabled declaration emit in web tsconfig**
- **Found during:** Task 2 (build verification)
- **Issue:** Better Auth's complex generic types caused "inferred type cannot be named without reference to internal better-auth module" errors during Next.js type checking, because declaration: true (inherited from base) triggers portability checks
- **Fix:** Set declaration: false and declarationMap: false in apps/web tsconfig. This is correct since the app uses noEmit: true
- **Files modified:** apps/web/tsconfig.json
- **Verification:** `pnpm -r build` succeeds cleanly
- **Committed in:** 51b3d23 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** All auto-fixes necessary for the build to succeed. No scope creep. The .js extension issue was a latent bug from Phase 1 that only surfaced when Next.js first bundled the db package.

## Issues Encountered
- Better Auth runtime warning about BETTER_AUTH_SECRET during build -- expected, this is a runtime env var that will be set in production/dev. The build still succeeds.
- Better Auth runtime warning about BETTER_AUTH_URL -- same, expected for build-time. Will be set via env var.

## User Setup Required

Environment variables needed for runtime (not blocking build):
- `BETTER_AUTH_SECRET` - Required by Better Auth for session encryption
- `BETTER_AUTH_URL` - Base URL for auth callbacks (e.g., http://localhost:3000 in dev)
- `NEXT_PUBLIC_APP_URL` - Public app URL for invite links
- `RESEND_API_KEY` - Optional, for sending invite emails (console.log fallback in dev)

## Next Phase Readiness
- Auth infrastructure is complete and ready for Plan 02-02 (auth UI pages) and 02-03 (middleware + invite flow)
- All auth tables defined, server configured, client hooks exported, API route live
- No blockers for downstream plans

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (c004450, 51b3d23) verified in git log.

---
*Phase: 02-authentication-tenancy*
*Completed: 2026-04-21*
