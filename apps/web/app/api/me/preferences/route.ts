import { NextResponse } from 'next/server';
import { db } from '@beagle-console/db';
import { users } from '@beagle-console/db/schema/auth-schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { requireTenantContext } from '@/lib/get-tenant';
import {
  PreferencesPatchSchema,
  UserPreferencesDefault,
  mergePreferences,
} from '@/lib/preferences';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { session } = await requireTenantContext();
    const rows = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const stored = rows[0]?.preferences ?? {};
    const merged = mergePreferences(UserPreferencesDefault, stored);
    return NextResponse.json(merged, { status: 200 });
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('GET /api/me/preferences error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { session } = await requireTenantContext();
    const body = await request.json();
    const delta = PreferencesPatchSchema.parse(body);

    // Read existing, merge, write back.
    const rows = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const stored = rows[0]?.preferences ?? {};
    const current = mergePreferences(UserPreferencesDefault, stored);
    const next = { ...current, ...delta };

    await db
      .update(users)
      .set({ preferences: next, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    return NextResponse.json(next, { status: 200 });
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('PATCH /api/me/preferences error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
