import { eq } from 'drizzle-orm';
import { tenants } from './schema/shared';

// For v1: vaults on BeagleHQ filesystem, synced via Dropbox
// Typical path: /home/lucas/Dropbox/Vaults/{tenant-slug}
const VAULT_BASE_PATH =
  process.env.VAULT_BASE_PATH ?? '/home/lucas/Dropbox/Vaults';

export async function resolveVaultPath(
  db: { select: Function; [key: string]: unknown },
  tenantId: string,
): Promise<string | null> {
  const result = await (db as any)
    .select({ vaultPath: tenants.vaultPath })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return result[0]?.vaultPath ?? null;
}

export { VAULT_BASE_PATH };
