import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getMinioClient } from '@beagle-console/db';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';

export const runtime = 'nodejs';

/**
 * Phase 18-01: stream bytes through the web app instead of redirecting to a
 * MinIO presigned URL. The previous implementation redirected to
 * `http://beagle-console-minio-1:9000/...` — the internal Docker hostname,
 * which (a) browsers can't resolve from the public internet and (b) triggers
 * mixed-content blocking on the HTTPS console. Streaming server-side keeps
 * the internal hostname server-side only and lets us reuse the existing
 * tenant-scoped auth on the route.
 *
 * Query params:
 *   ?inline=1  → Content-Disposition: inline (for image/PDF iframes/<img>)
 *   default    → Content-Disposition: attachment (for downloads)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantContext();
    const { id } = await params;
    const { db: tdb, schema } = getTenantDb(tenantId);

    const [artifact] = await tdb
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.id, id))
      .limit(1);

    if (!artifact) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const client = getMinioClient();
    const command = new GetObjectCommand({
      Bucket: `tenant-${tenantId}`,
      Key: artifact.minioKey,
    });
    const response = await client.send(command);

    if (!response.Body) {
      return NextResponse.json(
        { error: 'Object body unavailable' },
        { status: 500 },
      );
    }

    const url = new URL(request.url);
    const inline = url.searchParams.get('inline') === '1';
    const safeFilename = artifact.filename.replace(/"/g, '');
    const disposition = inline
      ? `inline; filename="${safeFilename}"`
      : `attachment; filename="${safeFilename}"`;

    const headers = new Headers({
      'Content-Type': artifact.mimeType ?? 'application/octet-stream',
      'Content-Disposition': disposition,
      // Short cache: artifacts are immutable per id but auth-gated, so prevent
      // shared caches from holding bytes after a tenant change.
      'Cache-Control': 'private, max-age=60',
    });
    if (response.ContentLength) {
      headers.set('Content-Length', String(response.ContentLength));
    }

    // response.Body is a SdkStreamMixin (Node Readable). Convert to a Web
    // ReadableStream that NextResponse / fetch can consume directly.
    const webStream = response.Body.transformToWebStream();

    return new Response(webStream, { headers });
  } catch (error) {
    console.error('GET /api/artifacts/[id]/download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
