import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

/**
 * MinIO uses S3-compatible API. Client connects to MinIO container
 * on internal Docker network.
 */
export function getMinioClient(): S3Client {
  return new S3Client({
    endpoint: `http://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? '9000'}`,
    region: 'us-east-1', // MinIO ignores region but SDK requires it
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    },
    forcePathStyle: true, // Required for MinIO (not virtual-hosted-style)
  });
}

/**
 * Ensure a bucket exists in MinIO. Creates it if missing.
 * Used by provisionTenant() to create per-tenant artifact buckets (per D-08).
 */
export async function ensureBucket(bucketName: string): Promise<void> {
  const client = getMinioClient();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log(`Created MinIO bucket: ${bucketName}`);
  }
}
