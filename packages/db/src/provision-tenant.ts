import { sql } from 'drizzle-orm';
import { db } from './client.js';
import { tenants } from './schema/shared.js';
import { ensureBucket } from './minio-client.js';

interface ProvisionTenantInput {
  name: string;
  slug: string;
  vaultPath?: string;
}

/**
 * Provision a new tenant: create DB record, PostgreSQL schema, and MinIO bucket.
 */
export async function provisionTenant(input: ProvisionTenantInput) {
  // 1. Insert tenant record
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: input.name,
      slug: input.slug,
      vaultPath: input.vaultPath ?? null,
    })
    .returning();

  if (!tenant) {
    throw new Error('Failed to insert tenant record');
  }

  const schemaName = `tenant_${tenant.id}`;

  // 2. Create PostgreSQL schema
  await db.execute(
    sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`,
  );

  // 3. Run tenant migrations on new schema
  await db.execute(sql`SET search_path TO ${sql.identifier(schemaName)}`);
  // Future: apply tenant-specific migrations here
  await db.execute(sql`SET search_path TO public`);

  // 4. Create MinIO bucket for tenant artifacts (per D-13)
  const bucketName = `tenant-${input.slug}`;
  await ensureBucket(bucketName);

  console.log(
    `Provisioned tenant: ${tenant.name} (schema: ${schemaName}, bucket: ${bucketName})`,
  );
  return tenant;
}
