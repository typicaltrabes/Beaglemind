/**
 * Phase 17.1-06 (DEFECT-17-B) — GET /api/artifacts/[id].
 *
 * Returns thin metadata for a single artifact so the transcript's
 * UserMessageAttachments component can decide between inline-image rendering
 * and ArtifactCard. Tenant-scoped lookup mirrors the existing
 * /preview and /download routes (T-04-07 / T-07-01).
 *
 * Response shape:
 *   { id, filename, mimeType, sizeBytes }
 *
 * Threat-model note (T-17-1-06-01): cross-tenant artifact ID enumeration is
 * mitigated by `requireTenantContext` + tenant-scoped DB pool — same trust
 * boundary as the download/preview routes. We deliberately do NOT expose
 * `extractedText` or `description` here (kept in the hub-side prompt block
 * only — clients have no business reading raw extracted PDF text).
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantContext();
    const { id } = await params;
    const { db: tdb, schema } = getTenantDb(tenantId);

    // Tenant-scoped artifact lookup — same pattern as preview/download.
    const [artifact] = await tdb
      .select({
        id: schema.artifacts.id,
        filename: schema.artifacts.filename,
        mimeType: schema.artifacts.mimeType,
        sizeBytes: schema.artifacts.sizeBytes,
      })
      .from(schema.artifacts)
      .where(eq(schema.artifacts.id, id))
      .limit(1);

    if (!artifact) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(artifact);
  } catch (error) {
    console.error('GET /api/artifacts/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
