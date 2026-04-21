import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireTenantContext } from '@/lib/get-tenant';
import { db, pushSubscriptions } from '@beagle-console/db';

export const runtime = 'nodejs';

// T-10-03: Validate subscription shape with Zod before storage
const SubscriptionBody = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

export async function POST(request: Request) {
  try {
    // T-10-02: Require authenticated session
    const { session } = await requireTenantContext();
    const userId = session.user.id;

    const body = await request.json();
    const { subscription } = SubscriptionBody.parse(body);

    // Upsert -- on conflict (userId, endpoint) do nothing (already subscribed)
    await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: subscription.endpoint,
        keysP256dh: subscription.keys.p256dh,
        keysAuth: subscription.keys.auth,
      })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.digest?.includes('NEXT_REDIRECT')) throw err;
    const status = err?.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status });
  }
}
