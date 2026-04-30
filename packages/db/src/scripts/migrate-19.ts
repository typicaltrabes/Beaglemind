import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/beagle_console';

/**
 * Phase 19 schema migration (idempotent).
 *
 * Adds 5 columns to tenant_<id>.runs:
 *   - round_count INT NOT NULL DEFAULT 3
 *   - idle_timeout_minutes INT NOT NULL DEFAULT 7
 *   - inter_round_pause_ms INT NOT NULL DEFAULT 1500
 *   - last_event_at TIMESTAMP NULL
 *   - current_round INT NULL
 *
 * Source-of-truth for tenant discovery: shared.organizations (per Phase 14
 * fix; matches migrate-17-1.ts exactly).
 *
 * Re-running is a no-op via ADD COLUMN IF NOT EXISTS.
 *
 * Per-tenant try/catch: one bad tenant must not block the rest. Logged and
 * skipped so the deploy plan can still finish.
 *
 * Run via: pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-19.ts
 */
export async function migratePhase19() {
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
          ALTER TABLE ${sql.identifier(schemaName)}.runs
          ADD COLUMN IF NOT EXISTS round_count integer NOT NULL DEFAULT 3,
          ADD COLUMN IF NOT EXISTS idle_timeout_minutes integer NOT NULL DEFAULT 7,
          ADD COLUMN IF NOT EXISTS inter_round_pause_ms integer NOT NULL DEFAULT 1500,
          ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
          ADD COLUMN IF NOT EXISTS current_round integer
        `);
        console.log(`Migrated ${schemaName}.runs`);
      } catch (err) {
        console.error(`Failed migration step for ${schemaName}:`, err);
      }
    }

    console.log(`Phase 19 migration complete (${tenantRows.length} tenants).`);
  } finally {
    await client.end();
  }
}

// Allow direct invocation: pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-19.ts
if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  migratePhase19().catch((err) => {
    console.error('Phase 19 migration failed:', err);
    process.exit(1);
  });
}
