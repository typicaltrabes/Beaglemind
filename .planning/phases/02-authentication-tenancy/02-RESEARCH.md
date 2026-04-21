# Phase 2: Authentication & Tenancy - Research

**Researched:** 2026-04-21
**Domain:** Better Auth + Next.js 15.5 multi-tenant authentication
**Confidence:** HIGH

## Summary

Better Auth 1.6.5 (current stable) provides a comprehensive, self-hosted auth framework with first-class Organization and Two-Factor plugins that map directly to the phase requirements. The Organizations plugin treats each org as a tenant (1 org = 1 tenant), with invitation-based membership, role management (owner/admin/member), and active organization tracking on the session object. The 2FA plugin provides TOTP with backup codes out of the box.

The critical implementation challenge is the invite-only flow: Better Auth does not have a single "invite-only mode" toggle. Instead, you combine `emailAndPassword.disableSignUp: true` with a custom flow where invited users are created server-side (via `auth.api.signUpEmail` called from an accept-invitation handler), bypassing the disabled public signup. This is a well-documented pattern in the Better Auth community.

**Primary recommendation:** Configure Better Auth with Organizations + 2FA plugins, Drizzle adapter pointed at the shared pgSchema, `disableSignUp: true`, and a custom invite-acceptance route that creates the user server-side then auto-joins the org.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Better Auth Organizations plugin: 1 org = 1 tenant. Org ID is the tenant ID used for schema lookup via `getTenantDb(tenantId)`.
- **D-02:** Database sessions (not JWT) -- stored in shared schema, revocable. Better Auth Drizzle adapter configured to use `shared` schema tables.
- **D-03:** Auth tables (users, sessions, accounts, organizations, members, invitations) all live in the `shared` schema alongside the tenant registry. Tenant-specific data lives in `tenant_{uuid}` schemas.
- **D-04:** TOTP-based MFA via Better Auth MFA plugin. Authenticator app only -- no SMS, no email OTP.
- **D-05:** Public registration disabled. Users can only join via organization invite.
- **D-06:** Custom auth pages built with shadcn/ui forms, matching the dark theme from wireframes (bg: #0f1115, accent: #f7b733 beagle gold). Pages: login, signup (invite-only), MFA challenge, MFA setup.
- **D-07:** Auth pages are public routes (no middleware). All other routes require authentication and tenant context.
- **D-08:** Next.js middleware extracts the user's organization from their session (via Better Auth). Sets `x-tenant-id` header on the request. All API route handlers call `getTenantDb(tenantId)` to get schema-scoped database access.
- **D-09:** Middleware rejects requests with no valid session (redirect to login) or no organization membership (redirect to "no org" page).
- **D-10:** Integration tests asserting cross-tenant isolation: User in Tenant A cannot access Tenant B data even by manipulating request parameters. This is the #1 security risk per research PITFALLS.md.
- **D-11:** Admin invites users via Better Auth Organizations invite API. Invite sent by email with a join link.
- **D-12:** Invited user clicks link -> lands on signup page pre-filled with org context -> creates account -> auto-joins the org.
- **D-13:** Tenant provisioning script (from Phase 1) extended to: create org in Better Auth, create first admin user, send invite email OR set initial password.

### Claude's Discretion
- Better Auth Drizzle adapter table schema details
- Email transport configuration (resend, nodemailer, etc.)
- Session cookie configuration (httpOnly, secure, sameSite)
- Password hashing algorithm (Better Auth default is fine)
- Rate limiting on auth endpoints

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email/password (invite-only) | Better Auth `disableSignUp: true` + server-side user creation on invite accept. See Invite-Only Flow pattern. |
| AUTH-02 | Session persists across browser refresh (database sessions) | Better Auth database sessions by default. Session table in shared schema, `storeSessionInDatabase: true`. |
| AUTH-03 | User can enable MFA/2FA | Better Auth `twoFactor()` plugin with TOTP. Returns `totpURI` for QR code + backup codes. |
| AUTH-04 | User can log out from any page | `authClient.signOut()` client method. Database session deleted server-side on logout. |
| AUTH-05 | Admin can invite users to tenant via email | Organizations plugin `inviteMember()` + `sendInvitationEmail` callback. |
| AUTH-06 | Tenant isolation enforced at middleware layer | Next.js middleware reads `activeOrganizationId` from session, sets `x-tenant-id` header. All routes use `getTenantDb(tenantId)`. |
| AUTH-07 | Per-tenant PostgreSQL schema provisioned via admin script | Existing `provisionTenant()` extended to create Better Auth org + first admin user. |
| AUTH-08 | Organization-based tenancy via Better Auth Organizations plugin | Organizations plugin configured with `organization()`. 1 org = 1 tenant. Session carries `activeOrganizationId`. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | 1.6.5 | Auth framework | Self-hosted, TypeScript-first, built-in Organizations + 2FA plugins, Drizzle adapter [VERIFIED: npm registry -- `npm view better-auth version` returns 1.6.5] |
| drizzle-orm | 0.45.2 | ORM (already installed) | pgSchema for shared schema tables, Drizzle adapter for Better Auth [VERIFIED: packages/db/package.json] |
| resend | 6.12.2 | Email transport | Simplest API for transactional email, free tier (100 emails/day). Lighter than nodemailer for invite emails [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @better-auth/cli | (bundled) | Schema generation | Run `npx auth generate` to output Drizzle schema for auth tables |
| qrcode | latest | QR code generation | Convert TOTP URI to QR image for MFA setup page |
| zod | (already in stack) | Form validation | Validate login/signup form inputs on client and server |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| resend | nodemailer + SMTP | nodemailer requires SMTP server config. Resend is API-based, simpler setup, free tier sufficient for invite emails. Switch to nodemailer if self-hosted SMTP is required. |
| resend | @sendgrid/mail | SendGrid is heavier, overkill for invite-only emails. Resend is simpler. |

**Installation:**
```bash
# In apps/web
pnpm add better-auth resend qrcode
pnpm add -D @types/qrcode

# In packages/db (already has drizzle-orm)
# No new deps needed -- Better Auth Drizzle adapter is built into better-auth
```

## Architecture Patterns

### Recommended Project Structure

```
apps/web/
  app/
    api/auth/[...all]/route.ts    # Better Auth API handler
    (auth)/                        # Auth route group (public, no middleware)
      login/page.tsx
      signup/page.tsx              # Invite-only signup
      mfa-challenge/page.tsx
      mfa-setup/page.tsx
      accept-invite/[id]/page.tsx  # Invitation acceptance
      no-org/page.tsx              # No organization membership
    (dashboard)/                   # Protected route group
      layout.tsx                   # Requires auth + tenant
      page.tsx                     # Empty dashboard placeholder
  lib/
    auth.ts                        # Better Auth server instance
    auth-client.ts                 # Better Auth client instance
  middleware.ts                    # Tenant-scoping middleware
  components/
    ui/                            # shadcn/ui components
    auth/                          # Auth-specific form components

packages/db/
  src/
    schema/
      shared.ts                    # Extended with auth tables
      auth-schema.ts               # Generated Better Auth tables for shared pgSchema
```

### Pattern 1: Better Auth Server Configuration

**What:** Central auth configuration with Organizations + 2FA plugins, Drizzle adapter pointing to shared schema.
**When to use:** Single configuration file, imported by API route and middleware.

```typescript
// apps/web/lib/auth.ts
// Source: https://better-auth.com/docs/installation + https://better-auth.com/docs/plugins/organization
import { betterAuth } from "better-auth";
import { organization, twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@beagle-console/db";
import * as authSchema from "@beagle-console/db/schema/auth-schema";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  appName: "Beagle Agent Console",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // D-05: invite-only
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 300, // 5 min cache
    },
  },
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        // Send invite via Resend
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite/${data.id}`;
        await sendInviteEmail({
          to: data.email,
          inviterName: data.inviter.user.name,
          orgName: data.organization.name,
          inviteLink,
          role: data.role,
        });
      },
      allowUserToCreateOrganization: false, // Only provisioning script creates orgs
      creatorRole: "owner",
    }),
    twoFactor({
      issuer: "Beagle Agent Console",
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, length: 8 },
    }),
    nextCookies(), // Required for server actions cookie handling
  ],
});

export type Session = typeof auth.$Infer.Session;
```
[VERIFIED: Better Auth docs at better-auth.com/docs/plugins/organization and better-auth.com/docs/plugins/2fa]

### Pattern 2: Better Auth Client Configuration

**What:** Client-side auth hooks and methods for React components.
**When to use:** All client-side auth interactions.

```typescript
// apps/web/lib/auth-client.ts
// Source: https://better-auth.com/docs/integrations/next
import { createAuthClient } from "better-auth/react";
import { organizationClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    twoFactorClient({
      twoFactorPage: "/mfa-challenge",
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization: orgClient,
  twoFactor,
} = authClient;
```
[VERIFIED: Better Auth docs at better-auth.com/docs/integrations/next]

### Pattern 3: API Route Handler

**What:** Catch-all route that delegates to Better Auth.
**When to use:** Single route file handles all auth API calls.

```typescript
// apps/web/app/api/auth/[...all]/route.ts
// Source: https://better-auth.com/docs/integrations/next
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```
[VERIFIED: Better Auth docs at better-auth.com/docs/integrations/next]

### Pattern 4: Tenant-Scoping Middleware (Next.js 15.5)

**What:** Middleware that checks session cookie (fast, edge-compatible), then API routes do full session + org validation.
**When to use:** Every non-auth request.

**Important constraint:** Next.js 15.5 middleware runs in Edge Runtime. Better Auth's `auth.api.getSession()` requires Node.js runtime (database access). Therefore, middleware can only do a lightweight cookie check. Full session + org resolution happens in a server-side utility called from route handlers and server components.

```typescript
// apps/web/middleware.ts
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/signup", "/mfa-challenge", "/accept-invite", "/no-org"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth pages are public
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API auth routes are public
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check session cookie exists (lightweight, edge-compatible)
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```
[VERIFIED: Better Auth docs at better-auth.com/docs/integrations/next]

```typescript
// apps/web/lib/get-tenant.ts -- server-side utility for full session + org resolution
import { auth } from "./auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function requireTenantContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const tenantId = session.session.activeOrganizationId;
  if (!tenantId) {
    redirect("/no-org");
  }

  return { session, tenantId };
}
```
[CITED: Pattern derived from Better Auth Next.js integration docs + Organization plugin session fields]

### Pattern 5: Invite-Only User Registration Flow

**What:** Custom flow that bypasses `disableSignUp` for invited users.
**When to use:** When an invited user clicks the invite link and needs to create an account.

The flow:
1. Admin calls `authClient.organization.inviteMember({ email, role, organizationId })`
2. Better Auth calls `sendInvitationEmail` with invitation ID
3. Invited user clicks link -> `/accept-invite/[invitationId]`
4. Accept-invite page checks invitation validity via `authClient.organization.getInvitation({ query: { id } })`
5. If user has no account: show signup form. Submit calls a server action that:
   a. Creates user via `auth.api.signUpEmail({ body: { email, password, name } })` -- this is a SERVER-SIDE call that bypasses `disableSignUp`
   b. Accepts the invitation via `auth.api.acceptInvitation(...)` on behalf of the new user
6. If user already has account: show login prompt, then accept invitation after login

```typescript
// Server action for invite acceptance
"use server";
import { auth } from "@/lib/auth";

export async function acceptInviteAction(data: {
  invitationId: string;
  email: string;
  password: string;
  name: string;
}) {
  // 1. Create user server-side (bypasses disableSignUp)
  const signupResult = await auth.api.signUpEmail({
    body: {
      email: data.email,
      password: data.password,
      name: data.name,
    },
  });

  // 2. Sign in to get session
  const signinResult = await auth.api.signInEmail({
    body: { email: data.email, password: data.password },
    asResponse: true,
  });

  // 3. Accept invitation (requires authenticated session)
  // The user needs to be signed in first, then accept
  // This may need the session headers from the signin response
}
```
[ASSUMED -- the server-side `signUpEmail` bypassing `disableSignUp` is the community-recommended approach but exact API behavior with `disableSignUp: true` needs testing]

### Pattern 6: Auth Table Schema in Shared pgSchema

**What:** Better Auth tables defined under the shared pgSchema so they coexist with the tenant registry.
**When to use:** Required for the Drizzle adapter to work with schema-scoped tables.

```typescript
// packages/db/src/schema/auth-schema.ts
// Generated by: npx auth generate, then manually adjusted for pgSchema
import { shared } from './shared';
import { text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const users = shared.table('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  twoFactorEnabled: boolean('two_factor_enabled'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = shared.table('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeOrganizationId: text('active_organization_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = shared.table('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const organizations = shared.table('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const members = shared.table('members', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invitations = shared.table('invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  inviterId: text('inviter_id').notNull().references(() => users.id),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  role: text('role'),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const twoFactors = shared.table('two_factors', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  verified: boolean('verified').notNull().default(false),
});
```
[CITED: Table structure from Better Auth Organization plugin docs (better-auth.com/docs/plugins/organization) and 2FA plugin docs (better-auth.com/docs/plugins/2fa). Column names verified against official schema documentation. Note: run `npx auth generate` to get exact output -- the above is directional.]

### Anti-Patterns to Avoid

- **Calling `auth.api.getSession()` in Edge middleware:** Better Auth needs database access. Edge Runtime cannot do this. Use `getSessionCookie()` for lightweight check, full validation in server components/route handlers.
- **Creating separate Better Auth instances per tenant:** One instance, shared schema. Tenant scoping happens at the data layer, not the auth layer.
- **Storing auth tables in tenant schemas:** Auth is cross-tenant (a user could theoretically belong to multiple orgs). All auth tables in shared schema.
- **Using JWT sessions:** Decision D-02 locks database sessions. JWT cannot be revoked for break-glass scenarios.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOTP generation/verification | Custom TOTP library | Better Auth `twoFactor()` plugin | Clock drift handling, backup codes, encrypted secret storage |
| Session management | Custom cookie/token system | Better Auth database sessions | CSRF protection, cookie security flags, session refresh |
| Organization membership | Custom org/member tables | Better Auth `organization()` plugin | Invitation flow, role management, active org tracking on session |
| Password hashing | Custom bcrypt/argon2 | Better Auth default (bcrypt) | Salt generation, timing-safe comparison |
| Email invite links | Custom token generation | Better Auth invitation API | Expiry, deduplication, status tracking |
| QR code for TOTP | Manual SVG generation | `qrcode` npm package | Cross-browser compatibility, error correction |

**Key insight:** Better Auth's plugin system handles the entire auth lifecycle. The only custom code needed is: (1) the invite-acceptance page/flow, (2) the tenant-scoping middleware/utility, and (3) the UI forms.

## Common Pitfalls

### Pitfall 1: Better Auth Drizzle Adapter with pgSchema

**What goes wrong:** Better Auth's CLI (`npx auth generate`) generates tables for the default `public` schema. If you pass these directly to the Drizzle adapter, tables land in `public` instead of `shared`.
**Why it happens:** The CLI does not know about custom pgSchema usage.
**How to avoid:** Run `npx auth generate` to see the expected table structure, then manually define the tables using the existing `shared` pgSchema from `packages/db/src/schema/shared.ts`. Pass the manually-defined schema to the Drizzle adapter.
**Warning signs:** Tables created in `public` schema instead of `shared`. Queries fail because adapter looks in wrong schema.
[CITED: Drizzle adapter docs show schema mapping -- better-auth.com/docs/adapters/drizzle]

### Pitfall 2: Edge Runtime vs Node.js in Middleware

**What goes wrong:** Calling `auth.api.getSession()` in Next.js 15.5 middleware fails because it needs database access, but middleware runs in Edge Runtime.
**Why it happens:** Next.js 15.x middleware uses Edge Runtime by default. Edge cannot import `postgres` driver.
**How to avoid:** Use `getSessionCookie()` from `better-auth/cookies` for lightweight check in middleware. Do full session validation in server components or API route handlers using the Node.js runtime.
**Warning signs:** Build errors about Node.js APIs not available in Edge, or runtime errors on deploy.
[VERIFIED: Better Auth Next.js docs explicitly document this limitation -- better-auth.com/docs/integrations/next]

### Pitfall 3: disableSignUp Blocking Invite Acceptance

**What goes wrong:** With `disableSignUp: true`, the client-side `authClient.signUp.email()` call fails for invited users trying to create accounts.
**Why it happens:** `disableSignUp` blocks ALL public signup endpoints, including for invited users.
**How to avoid:** Use server-side `auth.api.signUpEmail()` to create the user account during invite acceptance. Server-side API calls bypass the `disableSignUp` restriction. The client should call a server action, not the auth client directly.
**Warning signs:** Invited users get "signup disabled" error when trying to create account.
[ASSUMED -- community-recommended approach, exact server-side bypass behavior should be verified during implementation]

### Pitfall 4: Active Organization Not Set After First Login

**What goes wrong:** New user signs up via invite, but `session.activeOrganizationId` is null because no active org was set.
**Why it happens:** Accepting an invitation adds the user as a member but does not automatically set the org as active.
**How to avoid:** After invite acceptance and login, immediately call `authClient.organization.setActive({ organizationId })` or do it server-side. The accept-invite flow should handle this.
**Warning signs:** Middleware redirects to `/no-org` page even though user is a member of an org.
[CITED: Better Auth organization docs -- setActive is a separate call from accepting invitation]

### Pitfall 5: Tenant Data Leakage via Missing Scoping

**What goes wrong:** An API route forgets to call `getTenantDb(tenantId)` and queries the shared pool directly, potentially exposing cross-tenant data.
**Why it happens:** Developer oversight. No compile-time enforcement that tenant context is used.
**How to avoid:** (1) Never import `db` directly in API routes -- always use `getTenantDb()`. (2) Integration tests that create data in tenant A and verify it is invisible from tenant B. (3) Code review rule: every API route must start with `const { tenantId } = await requireTenantContext()`.
**Warning signs:** Data visible across tenants. This is catastrophic for a finance-focused product.
[CITED: PITFALLS.md -- Pitfall 2: Tenant Data Leakage]

### Pitfall 6: Cookie Configuration for Production

**What goes wrong:** Auth cookies don't work in production because secure/sameSite flags are misconfigured.
**Why it happens:** Development uses HTTP, production uses HTTPS via Caddy. Cookie flags must differ.
**How to avoid:** Set `advanced.useSecureCookies: true` in production (Better Auth reads this). Ensure `BETTER_AUTH_URL` env var is set to `https://console.beaglemind.ai`. Caddy handles TLS termination.
**Warning signs:** Login works locally but sessions don't persist in production.
[CITED: Better Auth options docs -- better-auth.com/docs/reference/options]

## Code Examples

### Email Transport with Resend

```typescript
// apps/web/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  orgName: string;
  inviteLink: string;
  role: string;
}) {
  await resend.emails.send({
    from: "Beagle Console <noreply@beaglemind.ai>",
    to: params.to,
    subject: `You've been invited to ${params.orgName}`,
    html: `
      <h2>Join ${params.orgName} on Beagle Console</h2>
      <p>${params.inviterName} has invited you as a ${params.role}.</p>
      <a href="${params.inviteLink}" style="
        display: inline-block;
        padding: 12px 24px;
        background: #f7b733;
        color: #0f1115;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
      ">Accept Invitation</a>
    `,
  });
}
```
[VERIFIED: Resend API -- resend.com/docs]

### MFA Setup Page Pattern

```typescript
// apps/web/app/(auth)/mfa-setup/page.tsx (client component)
"use client";
import { twoFactor } from "@/lib/auth-client";
import { useState } from "react";
import QRCode from "qrcode";

export default function MFASetupPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");

  async function enableMFA(password: string) {
    const { data, error } = await twoFactor.enable({ password });
    if (data?.totpURI) {
      const qr = await QRCode.toDataURL(data.totpURI);
      setQrDataUrl(qr);
      setBackupCodes(data.backupCodes);
    }
  }

  async function verifyMFA() {
    const { data, error } = await twoFactor.verifyTotp({
      code: verifyCode,
    });
    // twoFactorEnabled is now true
  }

  // Render: password prompt -> QR code + backup codes -> verification
}
```
[CITED: Better Auth 2FA docs -- better-auth.com/docs/plugins/2fa]

### MFA Challenge Page Pattern

```typescript
// When user with 2FA signs in, Better Auth redirects to twoFactorPage
// The client plugin handles this via onTwoFactorRedirect or twoFactorPage config

"use client";
import { twoFactor } from "@/lib/auth-client";

export default function MFAChallengerPage() {
  async function handleVerify(code: string) {
    const { data, error } = await twoFactor.verifyTotp({
      code,
      trustDevice: true, // Remember for 30 days
    });
    if (data) {
      window.location.href = "/"; // Dashboard
    }
  }

  // Render: 6-digit code input + "Use backup code" link
}
```
[CITED: Better Auth 2FA docs -- better-auth.com/docs/plugins/2fa]

### Extended Tenant Provisioning

```typescript
// packages/db/src/provision-tenant.ts (extension for Phase 2)
// Add after existing provisionTenant():

import { auth } from "../../apps/web/lib/auth"; // Or pass auth instance

export async function provisionTenantWithAuth(input: {
  name: string;
  slug: string;
  vaultPath?: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}) {
  // 1. Existing: create tenant record + schema + bucket
  const tenant = await provisionTenant({
    name: input.name,
    slug: input.slug,
    vaultPath: input.vaultPath,
  });

  // 2. Create Better Auth organization (org ID = tenant ID)
  const org = await auth.api.createOrganization({
    body: {
      name: input.name,
      slug: input.slug,
    },
    // Need admin session context -- this is a provisioning script concern
  });

  // 3. Create admin user
  const user = await auth.api.signUpEmail({
    body: {
      email: input.adminEmail,
      password: input.adminPassword,
      name: input.adminName,
    },
  });

  // 4. Add user to org as owner
  await auth.api.addMember({
    body: {
      userId: user.user.id,
      organizationId: org.id,
      role: ["owner"],
    },
  });

  return { tenant, org, user };
}
```
[ASSUMED -- exact server-side API for createOrganization without request headers needs verification. May need to use direct DB insert for provisioning script context.]

### shadcn/ui Login Form Pattern

```typescript
// apps/web/app/(auth)/login/page.tsx
"use client";
import { signIn } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    await signIn.email({
      email,
      password,
      callbackURL: "/",
    }, {
      onError: (ctx) => {
        setError(ctx.error.message ?? "Sign in failed");
        setLoading(false);
      },
      // 2FA redirect handled by twoFactorClient plugin
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-panel p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Beagle Agent Console</h1>
        <p className="text-gray-400 mb-6">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input, password input, submit button with accent bg */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 font-semibold text-bg hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>
      </div>
    </main>
  );
}
```
[ASSUMED -- shadcn/ui not yet initialized in the project. `components.json` missing. Need to run `npx shadcn@latest init` before using shadcn components. The above uses raw Tailwind matching existing theme.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth/Auth.js | Better Auth | 2024-2025 | Better Auth has built-in organizations, MFA, self-hosted. Auth.js adapter ecosystem is fragmented. |
| JWT sessions | Database sessions | Always available | Revocable, auditable, supports break-glass. Better Auth supports both. |
| next-auth middleware | Better Auth cookie check + server validation | 2025-2026 | Edge Runtime limitations mean lightweight middleware + full server validation. |
| Custom invite system | Better Auth Organizations invite API | Better Auth 1.4+ | Built-in invitation management with status tracking, expiry, roles. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Server-side `auth.api.signUpEmail()` bypasses `disableSignUp: true` | Pattern 5, Pitfall 3 | HIGH -- if server-side calls are also blocked, invite flow breaks. Fallback: use `databaseHooks.user.create.before` to check for valid invitation token instead of `disableSignUp`. |
| A2 | Better Auth Drizzle adapter works with custom pgSchema tables (not just public schema) | Pattern 6, Pitfall 1 | HIGH -- if adapter only works with public schema, need to generate auth tables in public and cross-reference. Test early. |
| A3 | `session.session.activeOrganizationId` is available after org is set active | Pattern 4 | MEDIUM -- field name might differ. Verify via `auth.$Infer.Session` type. |
| A4 | Extended provisioning can create org + user without an existing authenticated session | Code Examples | MEDIUM -- `createOrganization` API may require auth headers. May need direct DB inserts for provisioning. |
| A5 | shadcn/ui forms will work without `components.json` initialization | Code Examples | LOW -- need to run `npx shadcn@latest init` first. Not a blocker. |

## Open Questions

1. **Server-side signup bypass with `disableSignUp: true`**
   - What we know: `disableSignUp` blocks client-side `signUp.email()`. Community recommends server-side API calls.
   - What's unclear: Whether `auth.api.signUpEmail()` is also blocked by `disableSignUp`.
   - Recommendation: Test in Wave 0. If blocked, use `databaseHooks.user.create.before` to validate invitation token instead.

2. **Better Auth Drizzle adapter with pgSchema**
   - What we know: Drizzle adapter accepts a `schema` parameter. pgSchema creates schema-qualified table references.
   - What's unclear: Whether the adapter correctly generates SQL with `shared.` prefix for all queries.
   - Recommendation: Test in Wave 0 with a minimal setup. If problematic, generate tables in `public` schema and accept the tradeoff.

3. **Provisioning script auth context**
   - What we know: `auth.api.createOrganization()` expects headers from an authenticated request.
   - What's unclear: How to create orgs and users programmatically without a browser session (CLI provisioning script).
   - Recommendation: Use direct Drizzle inserts into the auth tables for provisioning, bypassing Better Auth API. Or use Better Auth's internal API with a synthetic admin context.

4. **Resend domain verification**
   - What we know: Resend requires domain verification to send from `@beaglemind.ai`.
   - What's unclear: Whether DNS records are already configured for beaglemind.ai.
   - Recommendation: Start with Resend's test mode or `onboarding@resend.dev` sender, verify domain when ready.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Database sessions, auth tables | Assumed (BeagleHQ VPS) | 17.4 | -- |
| Node.js | Better Auth, Next.js | Available (local dev) | -- | -- |
| pnpm | Package installation | Available | 10.33.0 | -- |
| Resend API key | Invite emails | Not yet configured | -- | Console.log invite links during dev |

**Missing dependencies with fallback:**
- Resend API key: not configured yet. During development, log invite links to console instead of sending emails. Configure Resend when ready for production.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (installed at root) |
| Config file | `/vitest.config.ts` (root level) |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Invite-only signup creates user | integration | `pnpm vitest run apps/web/tests/auth/invite-signup.test.ts -x` | Wave 0 |
| AUTH-02 | Session persists across requests | integration | `pnpm vitest run apps/web/tests/auth/session.test.ts -x` | Wave 0 |
| AUTH-03 | MFA enable/verify flow | integration | `pnpm vitest run apps/web/tests/auth/mfa.test.ts -x` | Wave 0 |
| AUTH-04 | Logout invalidates session | integration | `pnpm vitest run apps/web/tests/auth/logout.test.ts -x` | Wave 0 |
| AUTH-05 | Admin invite sends email | unit | `pnpm vitest run apps/web/tests/auth/invite.test.ts -x` | Wave 0 |
| AUTH-06 | Tenant isolation in middleware | integration | `pnpm vitest run apps/web/tests/auth/tenant-isolation.test.ts -x` | Wave 0 |
| AUTH-07 | Provisioning script creates schema + org | integration | `pnpm vitest run packages/db/src/__tests__/provision-auth.test.ts -x` | Wave 0 |
| AUTH-08 | Organization = tenant mapping | integration | `pnpm vitest run apps/web/tests/auth/org-tenant.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/web/tests/auth/` directory -- all auth test files
- [ ] `packages/db/src/__tests__/provision-auth.test.ts` -- extended provisioning tests
- [ ] Test utilities for creating Better Auth test instances with in-memory or test DB
- [ ] shadcn/ui initialization (`npx shadcn@latest init` in apps/web)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth email/password + TOTP MFA |
| V3 Session Management | yes | Better Auth database sessions, httpOnly cookies, session expiry |
| V4 Access Control | yes | Organization membership + role checks, tenant middleware scoping |
| V5 Input Validation | yes | Zod validation on all auth form inputs |
| V6 Cryptography | yes | Better Auth handles password hashing (bcrypt) and TOTP secret encryption |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data access | Information Disclosure | Middleware tenant scoping + `getTenantDb()` + integration tests (D-10) |
| Session fixation | Spoofing | Better Auth regenerates session on login |
| Brute force login | Spoofing | Rate limiting on auth endpoints (Claude's discretion) |
| CSRF on auth endpoints | Tampering | Better Auth built-in CSRF protection via origin check |
| Invitation link guessing | Spoofing | Better Auth uses cryptographic invitation IDs + expiry |
| MFA bypass | Elevation of Privilege | Better Auth enforces 2FA check before granting full session |

## Sources

### Primary (HIGH confidence)
- [Better Auth Organization Plugin](https://better-auth.com/docs/plugins/organization) -- complete organization API, invitation flow, roles, schema
- [Better Auth 2FA Plugin](https://better-auth.com/docs/plugins/2fa) -- TOTP setup, verification, backup codes
- [Better Auth Drizzle Adapter](https://better-auth.com/docs/adapters/drizzle) -- adapter config, schema mapping, CLI generation
- [Better Auth Next.js Integration](https://better-auth.com/docs/integrations/next) -- API route handler, middleware, session access
- [Better Auth Options Reference](https://better-auth.com/docs/reference/options) -- disableSignUp, session config, advanced options
- [npm registry: better-auth@1.6.5](https://www.npmjs.com/package/better-auth) -- version verified

### Secondary (MEDIUM confidence)
- [Better Auth email guide with Nodemailer](https://dev.to/rogasper/how-to-setup-email-verification-organization-invites-with-better-auth-and-nodemailer-19hk) -- email transport pattern
- [Better Auth invite-only discussion](https://www.answeroverflow.com/m/1354120448371196047) -- community pattern for invite-only registration
- [Resend API docs](https://resend.com/docs) -- email transport alternative

### Tertiary (LOW confidence)
- [Better Auth issue #4223: Invitation workflow](https://github.com/better-auth/better-auth/issues/4223) -- invite-only flow edge cases, still evolving
- [Better Auth issue #6716: Unverified users accepting invitations](https://github.com/better-auth/better-auth/issues/6716) -- may affect invite acceptance flow

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Better Auth 1.6.5 verified on npm, all plugin APIs documented on official site
- Architecture: HIGH -- patterns follow official Next.js integration docs, tenant-scoping builds on Phase 1 foundations
- Pitfalls: HIGH -- Edge runtime limitation well-documented, pgSchema concern derived from adapter docs
- Invite-only flow: MEDIUM -- community-recommended approach, exact server-side bypass needs testing (A1)
- Drizzle adapter + pgSchema: MEDIUM -- adapter accepts schema param but pgSchema integration untested (A2)

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days -- Better Auth is stable at 1.6.x)
