import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { hubClient } from '@/lib/api/hub-client';

export const runtime = 'nodejs';

const CreateRunBody = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { session, tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const body = await request.json();
    const { projectId, prompt } = CreateRunBody.parse(body);

    const rows = await tdb
      .insert(schema.runs)
      .values({
        projectId,
        prompt,
        status: 'pending',
        kind: 'research_sprint',
        createdBy: session.user.id,
      })
      .returning();

    const run = rows[0]!;

    await hubClient.startRun({
      runId: run.id,
      tenantId,
      prompt,
      targetAgent: 'jarvis',
    });

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/runs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
