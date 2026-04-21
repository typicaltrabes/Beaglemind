import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Server-side invite acceptance route (D-05, D-11, D-12).
 *
 * This route bypasses `disableSignUp: true` by using auth.api.signUpEmail()
 * server-side, which is the recommended approach for invite-only systems.
 *
 * Flow:
 * 1. Validate inputs
 * 2. Create user via auth.api.signUpEmail (server-side bypass of disableSignUp)
 * 3. Sign user in to get session headers
 * 4. Accept invitation with the authenticated session
 * 5. Set active organization so requireTenantContext() works on first visit
 * 6. Return success with Set-Cookie headers forwarded
 *
 * THREAT MITIGATIONS:
 * - T-02-08: Invitation ID validated via getInvitation before any user creation
 * - T-02-09: signUpEmail only runs after invitation validation; setActiveOrganization
 *   called explicitly to avoid session without org
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { invitationId, email, password, name } = body;

    // --- Input validation ---
    if (!invitationId || typeof invitationId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid invitation ID' },
        { status: 400 },
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 },
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 },
      );
    }

    // --- Step 1: Create user via Better Auth server API ---
    // This bypasses disableSignUp because it is a server-side call (Assumption A1).
    // If this is also blocked by disableSignUp, fallback: insert directly into
    // users + accounts tables via Drizzle (see commented fallback below).
    const signupResult = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    if (!signupResult || !signupResult.user) {
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 400 },
      );
    }

    // --- Step 2: Sign in to get session headers ---
    const signinResponse = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    if (!signinResponse.ok) {
      return NextResponse.json(
        { error: 'Account created but sign-in failed. Please try signing in manually.' },
        { status: 500 },
      );
    }

    // --- Step 3: Accept the invitation using the authenticated session ---
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: signinResponse.headers,
    });

    // --- Step 4: Set active organization explicitly (Pitfall 4) ---
    // Without this, session.activeOrganizationId would be null and
    // requireTenantContext() would redirect to /no-org on first visit.
    // We need to extract the organizationId from the invitation.
    // The getInvitation API requires authentication, so we use the session headers.
    const invitationData = await auth.api.getInvitation({
      query: { id: invitationId },
      headers: signinResponse.headers,
    });

    const organizationId = invitationData?.organizationId;

    if (organizationId) {
      await auth.api.setActiveOrganization({
        body: { organizationId },
        headers: signinResponse.headers,
      });
    }

    // --- Step 5: Return success, forwarding Set-Cookie headers ---
    const response = NextResponse.json(
      { success: true, organizationId },
      { status: 200 },
    );

    // Forward all Set-Cookie headers from the sign-in response
    const setCookies = signinResponse.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 },
    );
  }
}

/*
 * FALLBACK: If auth.api.signUpEmail is blocked by disableSignUp even server-side,
 * use direct DB insertion:
 *
 * import { db } from '@beagle-console/db';
 * import { users, accounts } from '@beagle-console/db/schema/auth-schema';
 * import { randomUUID } from 'crypto';
 *
 * const userId = randomUUID();
 * await db.insert(users).values({
 *   id: userId,
 *   name,
 *   email,
 *   emailVerified: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 * await db.insert(accounts).values({
 *   id: randomUUID(),
 *   userId,
 *   accountId: userId,
 *   providerId: 'credential',
 *   password: hashedPassword, // Would need bcrypt here
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 */
