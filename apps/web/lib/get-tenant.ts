import { auth } from './auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, createTenantSchema } from '@beagle-console/db';

/**
 * Server-side full session + organization validation (D-08, D-09).
 *
 * Runs in Node.js runtime (NOT Edge) -- safe to access database.
 * Called from server components and API route handlers.
 *
 * - No session -> redirect to /login
 * - No activeOrganizationId -> redirect to /no-org
 * - Returns { session, tenantId } for downstream use
 */
export async function requireTenantContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  const tenantId = session.session.activeOrganizationId;
  if (!tenantId) {
    redirect('/no-org');
  }

  return { session, tenantId };
}

/**
 * Returns the shared db instance plus tenant-scoped schema tables.
 *
 * Usage in API routes:
 *   const { tenantId } = await requireTenantContext();
 *   const { db, schema } = getTenantDb(tenantId);
 *   const rows = await db.select().from(schema.someTable);
 */
export function getTenantDb(tenantId: string) {
  const schema = createTenantSchema(tenantId);
  return { db, schema };
}
