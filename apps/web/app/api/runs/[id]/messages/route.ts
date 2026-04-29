import { NextResponse } from 'next/server';
import { eq, asc, inArray, and } from 'drizzle-orm';
import { z } from 'zod/v4';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getMinioClient } from '@beagle-console/db';
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
    // Phase 17.1-03: declared at the route scope so it's visible to the
    // hubClient.startRun call below. Populated only when the attachmentIds
    // branch resolves image rows under the 10 MB budget; otherwise stays
    // undefined and the hub Zod treats it as omitted.
    let imageAttachments:
      | Array<{ filename: string; mimeType: string; base64: string }>
      | undefined;
    if (attachmentIds.length > 0) {
      const rows = await tdb
        .select({
          id: schema.artifacts.id,
          filename: schema.artifacts.filename,
          mimeType: schema.artifacts.mimeType,
          sizeBytes: schema.artifacts.sizeBytes,
          extractedText: schema.artifacts.extractedText,
          description: schema.artifacts.description, // Phase 17.1: vision-API description, fed to buildAttachmentBlock
          minioKey: schema.artifacts.minioKey, // Phase 17.1-03: needed for vision base64 fetch
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

      // Phase 17.1-03: fetch image bytes from MinIO once and forward to the
      // hub as imageAttachments. The hub gates by visionCapable per-agent —
      // only Mo and Jarvis would receive the bytes; Herman and Sam see only
      // the description already baked into attachmentBlock by Plan 17.1-02.
      //
      // NOTE per openclaw-flag-verification.md (outcome D, 2026-04-29): the
      // OpenClaw `agent` CLI does not currently support image input flags,
      // so the hub-side bridge logs-and-skips the bytes for now. We still
      // fetch + forward them here so the wiring is in place the moment
      // OpenClaw ships a vision flag — only the bridge body changes.
      //
      // Total-bytes budget (10 MB) prevents blowing up the OpenClaw command
      // line on huge multi-image messages. Description still flows in the
      // prompt block regardless.
      const IMAGE_BYTES_BUDGET = 10 * 1024 * 1024;
      const imageRows = ordered.filter((r) => r.mimeType.startsWith('image/'));
      const totalImageBytes = imageRows.reduce(
        (sum, r) => sum + r.sizeBytes,
        0,
      );

      if (imageRows.length > 0 && totalImageBytes <= IMAGE_BYTES_BUDGET) {
        const minio = getMinioClient();
        imageAttachments = await Promise.all(
          imageRows.map(async (r) => {
            const obj = await minio.send(
              new GetObjectCommand({
                Bucket: `tenant-${tenantId}`,
                Key: r.minioKey,
              }),
            );
            const bytes = await obj.Body!.transformToByteArray();
            return {
              filename: r.filename,
              mimeType: r.mimeType,
              base64: Buffer.from(bytes).toString('base64'),
            };
          }),
        );
      } else if (totalImageBytes > IMAGE_BYTES_BUDGET) {
        console.warn(
          `Skipping image bytes — total ${totalImageBytes} exceeds 10 MB budget`,
        );
      }
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
    // Phase 17.1-06 (DEFECT-17-B): split user-visible content from agent-
    // visible prompt. The hub persists the user event with `prompt` (clean
    // user text) plus `attachmentIds` for chip rendering in the transcript;
    // the OpenClaw round-table receives `agentPrompt` (with the attachment
    // block + extracted text). When there are no attachments, agentPrompt
    // and prompt are identical and attachmentIds is omitted — preserves the
    // pre-17.1-06 contract for text-only messages.
    await hubClient.startRun({
      runId,
      tenantId,
      prompt: content,
      agentPrompt: attachmentBlock + content,
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
      imageAttachments, // Phase 17.1-03: undefined when no images / over budget — hub Zod treats it as omitted
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
