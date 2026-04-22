import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod/v4';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { hubClient } from '@/lib/api/hub-client';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: runId } = await params;
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const rows = await tdb
      .select()
      .from(schema.events)
      .where(eq(schema.events.runId, runId))
      .orderBy(asc(schema.events.sequenceNumber));

    // Map DB fields to HubEventEnvelope format expected by frontend
    const events = rows.map(row => ({
      type: row.type,
      agentId: row.agentId,
      runId: row.runId,
      tenantId,
      content: row.content,
      metadata: row.metadata,
      timestamp: row.createdAt?.toISOString() ?? new Date().toISOString(),
      sequenceNumber: row.sequenceNumber,
    }));

    return NextResponse.json(events);
  } catch (error) {
    console.error('GET /api/runs/[id]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const SendMessageBody = z.object({
  content: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: runId } = await params;
    const { session, tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const body = await request.json();
    const { content } = SendMessageBody.parse(body);

    // Update run to executing if it was completed (continue conversation)
    await tdb
      .update(schema.runs)
      .set({ status: 'executing', updatedAt: new Date() })
      .where(eq(schema.runs.id, runId));

    // Hub is the sole writer of events — it persists the user message through
    // its SequenceCounter and then kicks off the round-table. Propagate failure
    // to the client so it can retry rather than silently losing the message.
    await hubClient.startRun({
      runId,
      tenantId,
      prompt: content,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/runs/[id]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
