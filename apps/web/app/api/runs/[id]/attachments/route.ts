import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getMinioClient } from '@beagle-console/db';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import {
  extractAttachment,
  extractImageDescription,
} from '@/lib/extract-attachment';
import { resolveMime } from '@/lib/mime-from-extension';
import { rateLimitOk } from '@/lib/attachment-upload-rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/runs/[id]/attachments
 *
 * Multipart upload endpoint backing Plan 17-01's composer paperclip + drag-drop.
 *
 * Flow:
 *  1. Auth-scope via requireTenantContext() — tenantId is session-derived,
 *     never request-derived (T-17-02-01 mitigation).
 *  2. Per-user 10/min rate limit (T-17-02-05).
 *  3. Validate file presence + mime via resolveMime (Phase 17.1-05: filename
 *     extension fallback when browser/OS reports empty / octet-stream) + size
 *     <= 20 MB.
 *  4. Upload bytes to MinIO bucket `tenant-${tenantId}` at
 *     `runs/${runId}/uploads/${uuid}.${ext}` via PutObjectCommand.
 *  5. Run synchronous text extraction (PDF/DOCX/TXT/MD) — null for images
 *     and on extraction failure (the file is still uploaded; the user can
 *     still download it).
 *  6. Insert artifacts row with agent_id='user' and the extracted text.
 *  7. Respond { artifactId, filename, mimeType, sizeBytes } matching the
 *     contract Plan 17-01's uploadAttachment helper consumes.
 */

// Phase 17.1-05: ALLOWED mime gating now lives in `@/lib/mime-from-extension`
// (single source of truth shared with the composer). The local Set was
// removed; gate uses `resolveMime(file)` which falls back to the filename
// extension when file.type is empty / application/octet-stream — fixes
// DEFECT-17-A (Windows .md uploads rejected because the OS reports no mime).
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

const RunIdParam = z.object({ id: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, tenantId } = await requireTenantContext();
    const userId = session.user.id;

    const rawParams = await params;
    const { id: runId } = RunIdParam.parse(rawParams);

    if (!rateLimitOk(userId)) {
      return NextResponse.json(
        { error: 'rate limit exceeded' },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'file field required' },
        { status: 400 },
      );
    }
    // Phase 17.1-05: resolveMime returns the canonical mime when allowed
    // (preferring file.type, falling back to the filename extension when the
    // browser/OS reports empty or application/octet-stream) or null when
    // disallowed. Use the resolved value for downstream MinIO ContentType,
    // extraction routing, AND the persisted artifact row — never raw
    // file.type, which can be empty for valid .md uploads on Windows.
    const resolvedMime = resolveMime(file);
    if (!resolvedMime) {
      return NextResponse.json(
        { error: 'unsupported type' },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'file too large' },
        { status: 400 },
      );
    }

    const { db: tdb, schema } = getTenantDb(tenantId);

    // Read the bytes once — used for both MinIO upload and extraction.
    const buffer = Buffer.from(await file.arrayBuffer());

    // Derive the file extension from the original filename (fall back to 'bin').
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'bin';
    const minioKey = `runs/${runId}/uploads/${randomUUID()}.${ext}`;

    // Upload first — if this fails we never insert the artifact row.
    // ContentType uses resolvedMime (Phase 17.1-05) so MinIO records the
    // canonical mime even when the browser sent file.type=''.
    await getMinioClient().send(
      new PutObjectCommand({
        Bucket: `tenant-${tenantId}`,
        Key: minioKey,
        Body: buffer,
        ContentType: resolvedMime,
      }),
    );

    // Phase 17.1: text extraction and image description run in parallel —
    // they're independent and only one will produce a non-null result for any
    // given file. Promise.all keeps total latency = max(extract, vision) not
    // sum. Both helpers swallow their own errors and resolve to null on
    // failure, so Promise.all cannot reject.
    //
    // Phase 17.1-05: pass resolvedMime (not file.type) so the extraction
    // routing inside both helpers picks the right branch even when the
    // browser/OS reported no mime — otherwise a .md upload on Windows would
    // resolve mime via extension only to fall through extractAttachment's
    // mime switch and skip the markdown path.
    const [extractedText, description] = await Promise.all([
      extractAttachment(buffer, resolvedMime),
      extractImageDescription(buffer, resolvedMime),
    ]);

    const rows = await tdb
      .insert(schema.artifacts)
      .values({
        runId,
        filename: file.name,
        // Phase 17.1-05: persist the canonical mime, never raw file.type.
        // Downstream attachment-block + extractAttachment branches key on
        // mime_type and would mis-route on an empty value.
        mimeType: resolvedMime,
        sizeBytes: file.size,
        minioKey,
        agentId: 'user',
        extractedText,
        description,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      // Defensive: drizzle's returning() always yields the inserted row, but
      // narrow the type so the response below is safe.
      throw new Error('insert returned no row');
    }

    return NextResponse.json({
      artifactId: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // requireTenantContext redirects throw NEXT_REDIRECT — let them propagate.
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('POST /api/runs/[id]/attachments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
