import { NextResponse } from 'next/server';
import { requireOperator } from '@/lib/operator';
import { db, createTenantSchema } from '@beagle-console/db';
import { eq, and, gt, isNull, asc } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/operator/break-glass/[tenantId]/runs/[runId]
 * View a specific run's events during an active break-glass session (D-11).
 * Returns run details and full event stream (read-only).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; runId: string }> }
) {
  try {
    const { session } = await requireOperator();
    const { tenantId, runId } = await params;
    const { db: tdb, schema } = getTenantDb(tenantId);
    const now = new Date();

    // Verify active break-glass session
    const [activeSession] = await tdb
      .select({ id: schema.breakGlassAudit.id })
      .from(schema.breakGlassAudit)
      .where(
        and(
          eq(schema.breakGlassAudit.operatorId, session.user.id),
          gt(schema.breakGlassAudit.expiresAt, now),
          isNull(schema.breakGlassAudit.revokedAt)
        )
      );

    if (!activeSession) {
      return NextResponse.json(
        { error: 'No active break-glass session' },
        { status: 403 }
      );
    }

    // Get run details
    const [run] = await tdb
      .select({
        id: schema.runs.id,
        status: schema.runs.status,
        prompt: schema.runs.prompt,
        createdAt: schema.runs.createdAt,
      })
      .from(schema.runs)
      .where(eq(schema.runs.id, runId));

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Get events ordered by sequence
    const events = await tdb
      .select({
        id: schema.events.id,
        sequenceNumber: schema.events.sequenceNumber,
        type: schema.events.type,
        agentId: schema.events.agentId,
        content: schema.events.content,
        metadata: schema.events.metadata,
        createdAt: schema.events.createdAt,
      })
      .from(schema.events)
      .where(eq(schema.events.runId, runId))
      .orderBy(asc(schema.events.sequenceNumber));

    // No caching headers (T-09-09)
    return NextResponse.json(
      { run, events },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('GET /api/operator/break-glass/[tenantId]/runs/[runId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getTenantDb(tenantId: string) {
  const schema = createTenantSchema(tenantId);
  return { db, schema };
}
