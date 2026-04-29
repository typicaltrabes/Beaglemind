import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/beagle_console';

/**
 * Phase 17.1 schema migration (idempotent).
 *
 * Adds tenant_<id>.artifacts.description TEXT NULL.
 * Source-of-truth for tenant discovery is shared.organizations
 * (per Phase 14 fix; shared.tenants is empty by convention — see
 * provision-tenant.ts which inserts org.id = tenant.id).
 *
 * Re-running is a no-op via ADD COLUMN IF NOT EXISTS.
 *
 * Per-tenant try/catch: one bad tenant must not block the rest. Logged and
 * skipped so the deploy plan can still finish.
 *
 * Run via: pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-17-1.ts
 */
export async function migratePhase17_1() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    const tenantRows = (await db.execute(
      sql`SELECT id FROM shared.organizations`,
    )) as unknown as { id: string }[];

    for (const row of tenantRows) {
      // Sanitize tenant id the same way createTenantSchema does (hyphen -> underscore).
      const schemaName = `tenant_${row.id.replace(/-/g, '_')}`;
      try {
        await db.execute(sql`
          ALTER TABLE ${sql.identifier(schemaName)}.artifacts
          ADD COLUMN IF NOT EXISTS description text
        `);
        console.log(`Added ${schemaName}.artifacts.description`);
      } catch (err) {
        console.error(`Failed migration step for ${schemaName}:`, err);
      }
    }

    console.log(`Phase 17.1 migration complete (${tenantRows.length} tenants).`);
  } finally {
    await client.end();
  }
}

// Allow direct invocation: pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-17-1.ts
if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  migratePhase17_1().catch((err) => {
    console.error('Phase 17.1 migration failed:', err);
    process.exit(1);
  });
}
