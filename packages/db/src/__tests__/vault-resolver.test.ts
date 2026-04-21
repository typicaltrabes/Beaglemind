import { describe, it, expect, vi } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { resolveVaultPath } from '../vault-resolver.js';
import { createTenantSchema } from '../schema/tenant.js';

describe('resolveVaultPath', () => {
  it('returns vault path for a known tenant', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { vaultPath: '/home/lucas/Dropbox/Vaults/acme' },
      ]),
    };

    const result = await resolveVaultPath(mockDb, 'abc-123');
    expect(result).toBe('/home/lucas/Dropbox/Vaults/acme');
  });

  it('returns null for unknown tenant ID', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    const result = await resolveVaultPath(mockDb, 'nonexistent-id');
    expect(result).toBeNull();
  });
});

describe('createTenantSchema', () => {
  it('returns an object with runs and messages tables', () => {
    const tenantSchema = createTenantSchema('test-tenant-id');

    expect(tenantSchema).toHaveProperty('runs');
    expect(tenantSchema).toHaveProperty('messages');
    expect(tenantSchema).toHaveProperty('schema');
  });

  it('uses schema name tenant_{id} format', () => {
    const tenantId = 'abc-123-def';
    const tenantSchema = createTenantSchema(tenantId);

    // Drizzle getTableConfig exposes the schema name from pgSchema
    const runsConfig = getTableConfig(tenantSchema.runs);
    expect(runsConfig.schema).toBe(`tenant_${tenantId}`);

    const messagesConfig = getTableConfig(tenantSchema.messages);
    expect(messagesConfig.schema).toBe(`tenant_${tenantId}`);
  });
});
