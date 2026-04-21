import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { assertTransition, type RunStatus } from '@/lib/state-machine';
import { hubClient } from '@/lib/api/hub-client';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantContext();
    const { id: runId } = await params;
    const { db: tdb, schema } = getTenantDb(tenantId);

    // Fetch run (tenant-scoped)
    const [run] = await tdb
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Validate state transition to cancelled
    assertTransition(run.status as RunStatus, 'cancelled');

    // Update run status
    await tdb
      .update(schema.runs)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.runs.id, runId));

    // Record state transition
    await tdb.insert(schema.stateTransitions).values({
      runId,
      fromStatus: run.status,
      toStatus: 'cancelled',
      triggeredBy: 'user',
    });

    // Notify Hub to signal agents
    await hubClient.stopRun({ runId, tenantId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid state transition')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('POST /api/runs/[id]/stop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
