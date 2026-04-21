import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getMinioClient } from '@beagle-console/db';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import mammoth from 'mammoth';

export const runtime = 'nodejs';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantContext();
    const { id } = await params;
    const { db: tdb, schema } = getTenantDb(tenantId);

    // Tenant-scoped artifact lookup (T-07-01)
    const [artifact] = await tdb
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.id, id))
      .limit(1);

    if (!artifact) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const client = getMinioClient();

    if (artifact.mimeType === 'application/pdf') {
      // PDF: return presigned URL for iframe embedding (D-04)
      const command = new GetObjectCommand({
        Bucket: `tenant-${tenantId}`,
        Key: artifact.minioKey,
      });
      const url = await getSignedUrl(client, command, { expiresIn: 300 });
      return NextResponse.json({ type: 'pdf', url });
    }

    if (artifact.mimeType === DOCX_MIME) {
      // DOCX: fetch from MinIO, convert to HTML via mammoth (D-05)
      try {
        const command = new GetObjectCommand({
          Bucket: `tenant-${tenantId}`,
          Key: artifact.minioKey,
        });
        const response = await client.send(command);
        const bodyBytes = await response.Body?.transformToByteArray();

        if (!bodyBytes) {
          return NextResponse.json({
            type: 'error',
            message: 'Preview unavailable',
          });
        }

        const result = await mammoth.convertToHtml({
          buffer: Buffer.from(bodyBytes),
        });

        return NextResponse.json({ type: 'docx', html: result.value });
      } catch (conversionError) {
        console.error('DOCX conversion error:', conversionError);
        return NextResponse.json({
          type: 'error',
          message: 'Preview unavailable',
        });
      }
    }

    // Unsupported mime type
    return NextResponse.json({ type: 'unsupported' });
  } catch (error) {
    console.error('GET /api/artifacts/[id]/preview error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
