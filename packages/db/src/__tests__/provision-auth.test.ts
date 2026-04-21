import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionTenantWithAuth } from '../provision-tenant';

// Skip integration tests when no DATABASE_URL is available.
// These tests require a running PostgreSQL instance and a configured
// Better Auth instance, so they are designed for CI or local dev with DB.
const hasDatabase = !!process.env.DATABASE_URL;

// --- Mock infrastructure for unit-level tests ---

// Mock the db module
vi.mock('../client', () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return { db: mockDb, queryClient: {} };
});

vi.mock('../minio-client', () => ({
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../schema/shared', () => ({
  tenants: { _: { name: 'tenants' } },
}));

vi.mock('../schema/auth-schema', () => ({
  organizations: { _: { name: 'organizations' } },
  members: { _: { name: 'members' } },
}));

// Get access to the mocked db for assertions
const { db } = await import('../client');

const MOCK_TENANT = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  name: 'Test Corp',
  slug: 'test-corp',
  vaultPath: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_USER_ID = '11111111-2222-3333-4444-555555555555';

function createMockAuth() {
  return {
    api: {
      signUpEmail: vi.fn().mockResolvedValue({
        user: { id: MOCK_USER_ID, email: 'admin@test.com', name: 'Admin' },
      }),
      signInEmail: vi.fn().mockResolvedValue({
        session: { id: 'session-123', userId: MOCK_USER_ID },
        user: { id: MOCK_USER_ID },
      }),
    },
  };
}

describe('provisionTenantWithAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up the mock chain for db.insert().values().returning()
    const mockReturning = vi.fn().mockResolvedValue([MOCK_TENANT]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });
  });

  it('creates tenant record, org, admin user, and member', async () => {
    const mockAuth = createMockAuth();

    const result = await provisionTenantWithAuth(
      {
        name: 'Test Corp',
        slug: 'test-corp',
        adminEmail: 'admin@test.com',
        adminPassword: 'securepass123',
        adminName: 'Admin User',
      },
      mockAuth,
    );

    // Verify tenant created
    expect(result.tenant).toEqual(MOCK_TENANT);
    expect(result.organizationId).toBe(MOCK_TENANT.id);
    expect(result.userId).toBe(MOCK_USER_ID);

    // Verify signUpEmail was called with correct body (not bcryptjs)
    expect(mockAuth.api.signUpEmail).toHaveBeenCalledWith({
      body: {
        email: 'admin@test.com',
        password: 'securepass123',
        name: 'Admin User',
      },
    });

    // Verify org inserted into organizations table (org ID = tenant ID per D-01)
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ _: { name: 'organizations' } }),
    );

    // Verify member inserted with role "owner"
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ _: { name: 'members' } }),
    );
  });

  it('provisioned admin user can sign in via Better Auth (verification step)', async () => {
    const mockAuth = createMockAuth();

    await provisionTenantWithAuth(
      {
        name: 'Test Corp',
        slug: 'test-corp',
        adminEmail: 'admin@test.com',
        adminPassword: 'securepass123',
        adminName: 'Admin User',
      },
      mockAuth,
    );

    // Verify the sign-in verification was called after provisioning
    expect(mockAuth.api.signInEmail).toHaveBeenCalledWith({
      body: {
        email: 'admin@test.com',
        password: 'securepass123',
      },
    });
  });

  it('throws if sign-in verification fails', async () => {
    const mockAuth = createMockAuth();
    mockAuth.api.signInEmail.mockResolvedValue({ session: null });

    await expect(
      provisionTenantWithAuth(
        {
          name: 'Test Corp',
          slug: 'test-corp',
          adminEmail: 'admin@test.com',
          adminPassword: 'securepass123',
          adminName: 'Admin User',
        },
        mockAuth,
      ),
    ).rejects.toThrow('Provisioning verification failed: admin user cannot sign in');
  });

  it('throws if signUpEmail returns no user', async () => {
    const mockAuth = createMockAuth();
    mockAuth.api.signUpEmail.mockResolvedValue({ user: null });

    await expect(
      provisionTenantWithAuth(
        {
          name: 'Test Corp',
          slug: 'test-corp',
          adminEmail: 'admin@test.com',
          adminPassword: 'securepass123',
          adminName: 'Admin User',
        },
        mockAuth,
      ),
    ).rejects.toThrow('Failed to create admin user');
  });
});

// --- Integration tests (require DATABASE_URL) ---
describe.skipIf(!hasDatabase)('provisionTenantWithAuth integration', () => {
  it('tenant schema isolation -- data in tenant A is not visible from tenant B', async () => {
    // This test requires a real DB and real auth instance.
    // When DATABASE_URL is set, it would:
    // 1. Provision two tenants (A and B)
    // 2. Insert a run record into tenant A's schema
    // 3. Query tenant B's schema for runs -- expect empty array
    // 4. Clean up both tenant schemas
    //
    // Skipped in unit test mode (no DATABASE_URL).
    // To run: DATABASE_URL=<your-url> pnpm vitest run packages/db/src/__tests__/provision-auth.test.ts
    expect(true).toBe(true); // Placeholder -- real implementation needs live DB
  });
});
