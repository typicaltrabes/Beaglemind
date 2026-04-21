import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { desc } from 'drizzle-orm';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';

export const runtime = 'nodejs';

const CreateProjectBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const rows = await tdb
      .select()
      .from(schema.projects)
      .orderBy(desc(schema.projects.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const body = await request.json();
    const { name, description } = CreateProjectBody.parse(body);

    const [project] = await tdb
      .insert(schema.projects)
      .values({
        name,
        description,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
