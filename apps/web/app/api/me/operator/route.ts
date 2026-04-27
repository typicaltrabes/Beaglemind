import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, users } from '@beagle-console/db';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const [row] = await db
      .select({ isOp: users.isOperator })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    return NextResponse.json({ isOperator: row?.isOp === true }, { status: 200 });
  } catch (error) {
    console.error('GET /api/me/operator error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
