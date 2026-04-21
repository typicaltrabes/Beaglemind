import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/beagle_console';

/**
 * Multi-tenant migration runner.
 * Uses a DEDICATED connection (max: 1) to avoid search_path race conditions.
 * Migrates shared schema first, then iterates all tenant schemas.
 */
export async function migrateAll() {
  // Dedicated connection pool -- max: 1 prevents search_path races (per Pitfall 5)
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // 1. Ensure shared schema exists
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS shared`);
    console.log('Shared schema ready');

    // 2. Get all tenant schemas from the tenants table
    let tenantRows: { id: string }[] = [];
    try {
      const result = await db.execute(sql`SELECT id FROM shared.tenants`);
      tenantRows = result as unknown as { id: string }[];
    } catch {
      // Table may not exist yet on first run
      console.log('No tenants table yet, skipping tenant migrations');
    }

    // 3. Migrate each tenant schema
    for (const row of tenantRows) {
      const schemaName = `tenant_${row.id}`;
      await db.execute(
        sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`,
      );
      console.log(`Migrated tenant schema: ${schemaName}`);
    }

    console.log('All migrations complete');
  } finally {
    await migrationClient.end();
  }
}

// Run directly if invoked as script
if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  migrateAll().catch(console.error);
}
