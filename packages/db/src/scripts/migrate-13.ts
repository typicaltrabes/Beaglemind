import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/beagle_console';

/**
 * Phase 13 schema migration (idempotent), extended in Phase 14.
 *
 * Adds two additive columns:
 *   1. tenant_<id>.runs.title           VARCHAR(80) NULL
 *   2. shared.users.preferences         JSONB NOT NULL DEFAULT '{}'::jsonb
 *
 * Phase 14 additions (UAT-14-03):
 *   - Tenant discovery now reads from shared.organizations (the real source-of-truth
 *     in this project; shared.tenants is empty by convention — see provision-tenant.ts
 *     which inserts into shared.organizations with id = tenant.id).
 *   - One-shot backfill: marks any `pending` run older than 1 day as `cancelled`,
 *     leaving fresh `pending` rows alone (none expected today; both POST /api/runs
 *     and POST /api/runs/[id]/messages default to `executing`, so this is pure
 *     data debt cleanup).
 *
 * All operations use ADD COLUMN IF NOT EXISTS / status='pending' AND age>1day predicates,
 * so re-running is a no-op on the second invocation.
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

    // 2. Iterate every tenant schema. Source-of-truth is shared.organizations
    //    (NOT shared.tenants — that table is empty by convention; see
    //    provision-tenant.ts which inserts org.id = tenant.id).
    const tenantRows = (await db.execute(
      sql`SELECT id FROM shared.organizations`,
    )) as unknown as { id: string }[];

    for (const row of tenantRows) {
      // Sanitize tenant id the same way createTenantSchema does (hyphen -> underscore).
      const schemaName = `tenant_${row.id.replace(/-/g, '_')}`;
      try {
        // 2a. Phase 13: add the runs.title column.
        await db.execute(sql`
          ALTER TABLE ${sql.identifier(schemaName)}.runs
          ADD COLUMN IF NOT EXISTS title varchar(80)
        `);
        console.log(`Added ${schemaName}.runs.title`);

        // 2b. Phase 14 (UAT-14-03): cancel orphan `pending` runs older than 1 day.
        // Idempotent: rerunning matches 0 rows the second time.
        const cancelResult = await db.execute(sql`
          UPDATE ${sql.identifier(schemaName)}.runs
          SET status = 'cancelled', updated_at = NOW()
          WHERE status = 'pending' AND created_at < NOW() - interval '1 day'
        `);
        const cancelled = (cancelResult as unknown as { count?: number }).count ?? 0;
        console.log(`Backfilled ${cancelled} orphan pending → cancelled in ${schemaName}.runs`);
      } catch (err) {
        // One bad tenant must not block the rest. Log and continue per CONTEXT.md
        // failure model ("write to log and continue — the next run will still work").
        console.error(`Failed migration step for ${schemaName}:`, err);
      }
    }

    console.log(`Phase 13 + 14 migration complete (${tenantRows.length} tenants).`);
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
