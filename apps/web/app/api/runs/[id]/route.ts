import { NextResponse } from 'next/server';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const rows = await tdb
      .select({
        id: schema.runs.id,
        projectId: schema.runs.projectId,
        prompt: schema.runs.prompt,
        title: schema.runs.title,
        status: schema.runs.status,
        kind: schema.runs.kind,
        createdAt: schema.runs.createdAt,
        updatedAt: schema.runs.updatedAt,
      })
      .from(schema.runs)
      .where(eq(schema.runs.id, id))
      .limit(1);

    const run = rows[0];
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error('GET /api/runs/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
