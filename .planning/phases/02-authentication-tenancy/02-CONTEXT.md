# Phase 2: Authentication & Tenancy - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver secure user authentication with MFA into a tenant-isolated environment. Every request is scoped to the user's organization (tenant) at the middleware layer. Tenant provisioning creates the org, schema, and invites the first user. No public registration — invite-only.

This phase builds on Phase 1's database schema, tenant utilities, and provisioning script. It adds Better Auth, auth UI pages, tenant-scoping middleware, and the invite flow.

</domain>

<decisions>
## Implementation Decisions

### Better Auth Configuration
- **D-01:** Better Auth Organizations plugin: 1 org = 1 tenant. Org ID is the tenant ID used for schema lookup via `getTenantDb(tenantId)`.
- **D-02:** Database sessions (not JWT) — stored in shared schema, revocable. Better Auth Drizzle adapter configured to use `shared` schema tables.
- **D-03:** Auth tables (users, sessions, accounts, organizations, members, invitations) all live in the `shared` schema alongside the tenant registry. Tenant-specific data lives in `tenant_{uuid}` schemas.
- **D-04:** TOTP-based MFA via Better Auth MFA plugin. Authenticator app only — no SMS, no email OTP.
- **D-05:** Public registration disabled. Users can only join via organization invite.

### Auth UI
- **D-06:** Custom auth pages built with shadcn/ui forms, matching the dark theme from wireframes (bg: #0f1115, accent: #f7b733 beagle gold). Pages: login, signup (invite-only), MFA challenge, MFA setup.
- **D-07:** Auth pages are public routes (no middleware). All other routes require authentication and tenant context.

### Tenant Middleware
- **D-08:** Next.js middleware extracts the user's organization from their session (via Better Auth). Sets `x-tenant-id` header on the request. All API route handlers call `getTenantDb(tenantId)` to get schema-scoped database access.
- **D-09:** Middleware rejects requests with no valid session (redirect to login) or no organization membership (redirect to "no org" page).
- **D-10:** Integration tests asserting cross-tenant isolation: User in Tenant A cannot access Tenant B data even by manipulating request parameters. This is the #1 security risk per research PITFALLS.md.

### Invite Flow
- **D-11:** Admin invites users via Better Auth Organizations invite API. Invite sent by email with a join link.
- **D-12:** Invited user clicks link → lands on signup page pre-filled with org context → creates account → auto-joins the org.
- **D-13:** Tenant provisioning script (from Phase 1) extended to: create org in Better Auth, create first admin user, send invite email OR set initial password.

### Claude's Discretion
- Better Auth Drizzle adapter table schema details
- Email transport configuration (resend, nodemailer, etc.)
- Session cookie configuration (httpOnly, secure, sameSite)
- Password hashing algorithm (Better Auth default is fine)
- Rate limiting on auth endpoints

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Document
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260417 Beagle Agent Console — Design Doc v3.md` — §9 tenancy discipline, §13 security

### Research
- `.planning/research/STACK.md` — Better Auth 1.6.x configuration, Organizations plugin, Drizzle adapter
- `.planning/research/PITFALLS.md` — Critical: tenant data leakage via connection pool, Better Auth multi-tenant edge cases
- `.planning/research/ARCHITECTURE.md` — Middleware tenant scoping pattern

### Phase 1 Code (built)
- `packages/db/src/schema/shared.ts` — Shared schema definition (extend with auth tables)
- `packages/db/src/schema/tenant.ts` — Tenant schema factory
- `packages/db/src/tenant.ts` — getTenantDb(), provisionTenant() utilities
- `packages/db/src/migrate.ts` — Multi-tenant migration runner
- `apps/web/tailwind.config.ts` — Dark theme with beagle colors

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/schema/shared.ts` — Has tenant registry table, needs auth tables added
- `packages/db/src/tenant.ts` — provisionTenant() needs extension for Better Auth org creation
- `packages/db/src/connection.ts` — Shared connection pool, migration pool
- `apps/web` — Next.js 15.5 app with Tailwind dark theme ready
- shadcn/ui initialized in apps/web

### Established Patterns
- Drizzle pgSchema('shared') for cross-tenant tables
- createTenantSchema(tenantId) factory for per-tenant tables
- getTenantDb(tenantId) returns schema-scoped query builder
- pnpm workspace cross-references between packages/db and apps/web

### Integration Points
- Better Auth server instance in apps/web (API routes)
- Better Auth client instance in apps/web (React hooks)
- Middleware in apps/web/src/middleware.ts
- Auth tables added to packages/db shared schema
- provisionTenant() in packages/db extended with org creation

</code_context>

<specifics>
## Specific Ideas

- Login page should be clean and minimal — dark background, beagle gold accent on the submit button, centered form
- The "Beagle Agent Console" branding from the placeholder page should appear on the login page
- After login, user lands on an empty dashboard (placeholder for Phase 4's project list)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-authentication-tenancy*
*Context gathered: 2026-04-21*
