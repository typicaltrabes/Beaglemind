import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: runId } = await params;
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const events = await tdb
      .select()
      .from(schema.events)
      .where(eq(schema.events.runId, runId))
      .orderBy(asc(schema.events.sequenceNumber));

    return NextResponse.json(events);
  } catch (error) {
    console.error('GET /api/runs/[id]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
