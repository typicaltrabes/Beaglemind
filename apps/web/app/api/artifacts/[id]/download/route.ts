import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getMinioClient } from '@beagle-console/db';
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

    // Fetch artifact (tenant-scoped via getTenantDb -- T-04-07)
    const [artifact] = await tdb
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.id, id))
      .limit(1);

    if (!artifact) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Generate presigned URL with 5-min expiry (T-04-07)
    const client = getMinioClient();
    const command = new GetObjectCommand({
      Bucket: `tenant-${tenantId}`,
      Key: artifact.minioKey,
    });
    const url = await getSignedUrl(client, command, { expiresIn: 300 });

    return Response.redirect(url);
  } catch (error) {
    console.error('GET /api/artifacts/[id]/download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
