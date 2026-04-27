import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@beagle-console/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockSelect(),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => mockUpdate(),
      }),
    }),
  },
}));
vi.mock('@beagle-console/db/schema/auth-schema', () => ({
  users: {
    id: 'users.id',
    preferences: 'users.preferences',
    updatedAt: 'users.updatedAt',
  },
}));
const mockRequireTenantContext = vi.fn();
vi.mock('@/lib/get-tenant', () => ({
  requireTenantContext: () => mockRequireTenantContext(),
}));

import { GET, PATCH } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://test/api/me/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('GET /api/me/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue({ session: { user: { id: 'u1' } } });
  });

  it('returns full default when stored is empty {}', async () => {
    mockSelect.mockResolvedValue([{ preferences: {} }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.theme).toBe('dark');
    expect(json.defaultTab).toBe('writers-room');
    expect(json.defaultVerbosity).toBe('normal');
    expect(json.browserNotifications).toBe('off');
  });

  it('merges stored with default', async () => {
    mockSelect.mockResolvedValue([{ preferences: { theme: 'light' } }]);
    const res = await GET();
    const json = await res.json();
    expect(json.theme).toBe('light');
    expect(json.defaultTab).toBe('writers-room');
  });

  it('returns full default when row missing', async () => {
    mockSelect.mockResolvedValue([]);
    const res = await GET();
    const json = await res.json();
    expect(json.theme).toBe('dark');
  });
});

describe('PATCH /api/me/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue({ session: { user: { id: 'u1' } } });
    mockSelect.mockResolvedValue([{ preferences: {} }]);
    mockUpdate.mockResolvedValue([]);
  });

  it('accepts a partial body and returns merged preferences', async () => {
    const res = await PATCH(makeRequest({ theme: 'auto' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.theme).toBe('auto');
    expect(json.defaultTab).toBe('writers-room');
  });

  it('rejects invalid theme with 400', async () => {
    const res = await PATCH(makeRequest({ theme: 'pink' }));
    expect(res.status).toBe(400);
  });

  it('persists update via db.update().set()', async () => {
    await PATCH(makeRequest({ theme: 'light' }));
    expect(mockUpdate).toHaveBeenCalled();
  });
});
