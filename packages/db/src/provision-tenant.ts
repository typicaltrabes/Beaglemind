import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from './client';
import { tenants } from './schema/shared';
import { organizations, members } from './schema/auth-schema';
import { ensureBucket } from './minio-client';

interface ProvisionTenantInput {
  name: string;
  slug: string;
  vaultPath?: string;
}

/**
 * Input for provisioning a tenant with Better Auth org + admin user.
 */
export interface ProvisionTenantWithAuthInput {
  name: string;
  slug: string;
  vaultPath?: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
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

/**
 * Provision a tenant with full Better Auth integration (D-13).
 *
 * Creates:
 * 1. Tenant record + PostgreSQL schema + MinIO bucket (via provisionTenant)
 * 2. Admin user via auth.api.signUpEmail (Better Auth handles password hashing)
 * 3. Organization in Better Auth with ID = tenant ID (D-01 mapping)
 * 4. Owner membership linking admin user to org
 * 5. Verification: confirms admin can sign in via auth.api.signInEmail
 *
 * The authInstance parameter is passed by the caller to avoid circular
 * cross-package imports (packages/db cannot import from apps/web).
 *
 * NOTE: Organization and member records are inserted directly via Drizzle
 * because auth.api.createOrganization requires an authenticated request
 * context that is unavailable in a CLI provisioning script (Assumption A4).
 */
export async function provisionTenantWithAuth(
  input: ProvisionTenantWithAuthInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authInstance: any,
) {
  // 1. Create tenant record + schema + bucket
  const tenant = await provisionTenant({
    name: input.name,
    slug: input.slug,
    vaultPath: input.vaultPath,
  });

  // 2. Create admin user via Better Auth server API
  // auth.api.signUpEmail bypasses disableSignUp when called server-side (A1).
  // Better Auth handles password hashing internally (no bcryptjs needed).
  const signupResult = await authInstance.api.signUpEmail({
    body: {
      email: input.adminEmail,
      password: input.adminPassword,
      name: input.adminName,
    },
  });

  if (!signupResult?.user) {
    throw new Error(
      `Failed to create admin user for tenant ${tenant.name}: signUpEmail returned no user`,
    );
  }

  const userId = signupResult.user.id;

  // 3. Create Better Auth organization with org ID = tenant ID (D-01)
  // Using direct DB insert because createOrganization requires auth headers
  // that are unavailable in a provisioning script context (A4).
  await db.insert(organizations).values({
    id: tenant.id,
    name: input.name,
    slug: input.slug,
    createdAt: new Date(),
  });

  // 4. Add admin user as org owner
  await db.insert(members).values({
    id: randomUUID(),
    userId,
    organizationId: tenant.id,
    role: 'owner',
    createdAt: new Date(),
  });

  // 5. VERIFICATION: Confirm the provisioned user can actually sign in.
  // This catches hashing mismatches or Better Auth config issues at provisioning
  // time rather than at first login.
  const signinResult = await authInstance.api.signInEmail({
    body: {
      email: input.adminEmail,
      password: input.adminPassword,
    },
  });

  if (!signinResult?.session) {
    throw new Error(
      'Provisioning verification failed: admin user cannot sign in',
    );
  }

  console.log(
    `Provisioned tenant with auth: ${tenant.name} (org: ${tenant.id}, admin: ${input.adminEmail})`,
  );
  console.log('Verified: admin user can sign in successfully');

  return {
    tenant,
    organizationId: tenant.id,
    userId,
  };
}
