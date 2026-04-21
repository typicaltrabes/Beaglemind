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
    const { session, tenantId } = await requireTenantContext();
    const { id: runId } = await params;
    const { db: tdb, schema } = getTenantDb(tenantId);

    // Fetch run (tenant-scoped via getTenantDb -- T-04-05)
    const [run] = await tdb
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Validate state transition: planned -> approved (T-04-08)
    assertTransition(run.status as RunStatus, 'approved');

    // Update run status to executing (approved is transient)
    await tdb
      .update(schema.runs)
      .set({ status: 'executing', updatedAt: new Date() })
      .where(eq(schema.runs.id, runId));

    // Mark plan as approved
    await tdb
      .update(schema.plans)
      .set({ approvedAt: new Date(), approvedBy: session.user.id })
      .where(eq(schema.plans.runId, runId));

    // Record state transitions: planned->approved (user), approved->executing (system)
    await tdb.insert(schema.stateTransitions).values([
      {
        runId,
        fromStatus: run.status,
        toStatus: 'approved',
        triggeredBy: 'user',
      },
      {
        runId,
        fromStatus: 'approved',
        toStatus: 'executing',
        triggeredBy: 'system',
      },
    ]);

    // Notify Hub to tell Mo to proceed
    await hubClient.approveRun({ runId, tenantId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid state transition')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('POST /api/runs/[id]/approve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
