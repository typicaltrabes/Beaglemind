import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { eq, desc } from 'drizzle-orm';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { hubClient } from '@/lib/api/hub-client';

export const runtime = 'nodejs';

const CreateRunBody = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1),
  targetAgent: z.enum(['jarvis', 'mo', 'sam', 'herman']).default('mo'),
});

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');

    const query = tdb.select().from(schema.runs).orderBy(desc(schema.runs.createdAt));

    const rows = projectId
      ? await query.where(eq(schema.runs.projectId, projectId))
      : await query;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/runs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const body = await request.json();
    const { projectId, prompt, targetAgent } = CreateRunBody.parse(body);

    // Create run as 'executing' directly — skip plan approval for now
    const rows = await tdb
      .insert(schema.runs)
      .values({
        projectId,
        prompt,
        status: 'executing',
        kind: 'research_sprint',
        createdBy: session.user.id,
      })
      .returning();

    const run = rows[0]!;

    // Hub is the sole writer of events — it persists the user prompt through
    // its SequenceCounter, then kicks off the round-table in the background.
    // If the Hub is unreachable, fail the request so the UI can retry rather
    // than creating an orphan run with no events.
    await hubClient.startRun({
      runId: run.id,
      tenantId,
      prompt,
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
