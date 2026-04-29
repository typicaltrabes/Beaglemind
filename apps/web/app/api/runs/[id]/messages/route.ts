import { NextResponse } from 'next/server';
import { eq, asc, inArray, and } from 'drizzle-orm';
import { z } from 'zod/v4';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { hubClient } from '@/lib/api/hub-client';
import { buildAttachmentBlock } from '@/lib/attachment-block';

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
  // Phase 17-03: optional list of artifact UUIDs uploaded via
  // POST /api/runs/[id]/attachments (Plan 17-02). Validated as UUIDs and
  // capped at 4 to bound prompt size. Defaults to [] so the original
  // text-only contract still works (backward compatible).
  attachmentIds: z.array(z.string().uuid()).max(4).default([]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: runId } = await params;
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const body = await request.json();
    const { content, attachmentIds } = SendMessageBody.parse(body);

    // Phase 17-03: when attachmentIds is non-empty, fetch the artifact rows
    // scoped to (this runId, agentId='user') so callers can't reference
    // another run's artifact, an agent-produced output, or a deleted row.
    // Strict 404 path per the threat register (T-17-03-02 / T-17-03-03):
    // any mismatch between requested IDs and resolved rows fails the
    // request — silent skipping would let a sender bypass the cross-run
    // tampering check.
    let attachmentBlock = '';
    if (attachmentIds.length > 0) {
      const rows = await tdb
        .select({
          id: schema.artifacts.id,
          filename: schema.artifacts.filename,
          mimeType: schema.artifacts.mimeType,
          sizeBytes: schema.artifacts.sizeBytes,
          extractedText: schema.artifacts.extractedText,
          description: schema.artifacts.description, // Phase 17.1: vision-API description, fed to buildAttachmentBlock
        })
        .from(schema.artifacts)
        .where(
          and(
            inArray(schema.artifacts.id, attachmentIds),
            eq(schema.artifacts.runId, runId),
            eq(schema.artifacts.agentId, 'user'),
          ),
        );

      if (rows.length !== attachmentIds.length) {
        return NextResponse.json(
          { error: 'attachment not found' },
          { status: 404 },
        );
      }

      // `inArray(...)` returns rows in arbitrary order — reorder to match
      // the client-specified attachmentIds so [1], [2], etc. line up with
      // the user's selection order in the chip stack.
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = attachmentIds
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r));
      attachmentBlock = buildAttachmentBlock(ordered);
    }

    // Update run to executing if it was completed (continue conversation)
    await tdb
      .update(schema.runs)
      .set({ status: 'executing', updatedAt: new Date() })
      .where(eq(schema.runs.id, runId));

    // Hub is the sole writer of events — it persists the user message through
    // its SequenceCounter and then kicks off the round-table. Propagate failure
    // to the client so it can retry rather than silently losing the message.
    //
    // V1 simplification per PATTERNS.md: prepend the attachment block to the
    // user content here in the web app rather than passing structured
    // attachments to the hub. Keeps `RunStartBody`, `OpenClawOutbound`, and
    // `openclaw-cli-bridge.ts` schemas unchanged — the hub just sees a longer
    // prompt string. Image base64 pass-through is explicitly deferred.
    await hubClient.startRun({
      runId,
      tenantId,
      prompt: attachmentBlock + content,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/runs/[id]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
