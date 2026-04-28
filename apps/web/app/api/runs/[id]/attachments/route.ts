import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getMinioClient } from '@beagle-console/db';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { extractAttachment } from '@/lib/extract-attachment';
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
 *  3. Validate file presence + mime against ALLOWED_MIME + size <= 20 MB.
 *  4. Upload bytes to MinIO bucket `tenant-${tenantId}` at
 *     `runs/${runId}/uploads/${uuid}.${ext}` via PutObjectCommand.
 *  5. Run synchronous text extraction (PDF/DOCX/TXT/MD) — null for images
 *     and on extraction failure (the file is still uploaded; the user can
 *     still download it).
 *  6. Insert artifacts row with agent_id='user' and the extracted text.
 *  7. Respond { artifactId, filename, mimeType, sizeBytes } matching the
 *     contract Plan 17-01's uploadAttachment helper consumes.
 */

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
]);
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
    if (!ALLOWED_MIME.has(file.type)) {
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
    await getMinioClient().send(
      new PutObjectCommand({
        Bucket: `tenant-${tenantId}`,
        Key: minioKey,
        Body: buffer,
        ContentType: file.type,
      }),
    );

    // Synchronous extraction (≤20 MB; inline is fine for V1 per CONTEXT).
    const extractedText = await extractAttachment(buffer, file.type);

    const rows = await tdb
      .insert(schema.artifacts)
      .values({
        runId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        minioKey,
        agentId: 'user',
        extractedText,
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
