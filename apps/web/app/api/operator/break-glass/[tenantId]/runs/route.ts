import { NextResponse } from 'next/server';
import { requireOperator } from '@/lib/operator';
import { db, createTenantSchema } from '@beagle-console/db';
import { eq, and, gt, isNull, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/operator/break-glass/[tenantId]/runs
 * List runs for a tenant during an active break-glass session (D-11).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { session } = await requireOperator();
    const { tenantId } = await params;
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

    // Query runs joined with projects
    const runs = await tdb
      .select({
        id: schema.runs.id,
        projectName: schema.projects.name,
        status: schema.runs.status,
        prompt: schema.runs.prompt,
        createdAt: schema.runs.createdAt,
      })
      .from(schema.runs)
      .leftJoin(schema.projects, eq(schema.runs.projectId, schema.projects.id))
      .orderBy(desc(schema.runs.createdAt));

    return NextResponse.json(runs);
  } catch (error) {
    console.error('GET /api/operator/break-glass/[tenantId]/runs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getTenantDb(tenantId: string) {
  const schema = createTenantSchema(tenantId);
  return { db, schema };
}
