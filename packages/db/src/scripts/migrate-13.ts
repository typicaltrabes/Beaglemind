import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/beagle_console';

/**
 * Phase 13 schema migration (idempotent).
 *
 * Adds two additive columns:
 *   1. tenant_<id>.runs.title           VARCHAR(80) NULL
 *   2. shared.users.preferences         JSONB NOT NULL DEFAULT '{}'::jsonb
 *
 * Both use ADD COLUMN IF NOT EXISTS, so re-running is a no-op.
 * Per CONTEXT.md: "Both additive, nullable / defaulted, so no downtime risk."
 */
export async function migratePhase13() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    // 1. Add preferences column to shared.users (single statement).
    await db.execute(sql`
      ALTER TABLE shared.users
      ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    console.log('Added shared.users.preferences');

    // 2. Iterate every tenant schema and add runs.title.
    const tenantRows = (await db.execute(
      sql`SELECT id FROM shared.tenants`,
    )) as unknown as { id: string }[];

    for (const row of tenantRows) {
      // Sanitize tenant id the same way createTenantSchema does (hyphen -> underscore).
      const schemaName = `tenant_${row.id.replace(/-/g, '_')}`;
      await db.execute(sql`
        ALTER TABLE ${sql.identifier(schemaName)}.runs
        ADD COLUMN IF NOT EXISTS title varchar(80)
      `);
      console.log(`Added ${schemaName}.runs.title`);
    }

    console.log(`Phase 13 migration complete (${tenantRows.length} tenants).`);
  } finally {
    await client.end();
  }
}

// Allow direct invocation: pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-13.ts
if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  migratePhase13().catch((err) => {
    console.error('Phase 13 migration failed:', err);
    process.exit(1);
  });
}
