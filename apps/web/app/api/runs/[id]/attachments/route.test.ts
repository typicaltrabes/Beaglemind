import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ----------------------------------------------------------------
// Mock requireTenantContext + getTenantDb so the test bypasses Better Auth
// and Postgres entirely.
const mockRequireTenantContext = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock('@/lib/get-tenant', () => ({
  requireTenantContext: () => mockRequireTenantContext(),
  getTenantDb: (_tenantId: string) => ({
    db: { insert: mockInsert },
    schema: { artifacts: { __table: 'artifacts' } },
  }),
}));

// Mock the MinIO client — we only need .send() to resolve.
const mockMinioSend = vi.fn();
vi.mock('@beagle-console/db', () => ({
  getMinioClient: () => ({ send: mockMinioSend }),
}));

// Mock the AWS SDK PutObjectCommand so we can capture the ContentType.
const putObjectArgs: Array<Record<string, unknown>> = [];
vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class FakePutObjectCommand {
    constructor(args: Record<string, unknown>) {
      putObjectArgs.push(args);
    }
  },
}));

// Mock the extract helpers — they'd otherwise try to load pdf-parse / call
// Anthropic. We only need them to resolve.
const mockExtractAttachment = vi.fn();
const mockExtractImageDescription = vi.fn();
vi.mock('@/lib/extract-attachment', () => ({
  extractAttachment: (...args: unknown[]) => mockExtractAttachment(...args),
  extractImageDescription: (...args: unknown[]) =>
    mockExtractImageDescription(...args),
}));

// Mock the rate limiter to always permit (the limiter itself is tested elsewhere).
vi.mock('@/lib/attachment-upload-rate-limit', () => ({
  rateLimitOk: () => true,
}));

import { POST } from './route';

function makeMultipartRequest(file: File): Request {
  const fd = new FormData();
  fd.append('file', file);
  return new Request(
    `http://test/api/runs/${RUN_ID}/attachments`,
    {
      method: 'POST',
      body: fd,
    },
  );
}

// Real RFC 4122 v4 UUID — Zod's strict uuid format requires the version nibble
// (`-4xxx-`) and variant nibble (`-8xxx-`/`-9xxx-`/`-a/b`) to match.
const RUN_ID = '11111111-2222-4333-8444-555555555555';
const params = Promise.resolve({ id: RUN_ID });

describe('POST /api/runs/[id]/attachments — DEFECT-17-A (Windows .md fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    putObjectArgs.length = 0;
    mockRequireTenantContext.mockResolvedValue({
      session: { user: { id: 'user-1' } },
      tenantId: 'tenant-x',
    });
    mockMinioSend.mockResolvedValue(undefined);
    mockExtractAttachment.mockResolvedValue('# notes\nbody');
    mockExtractImageDescription.mockResolvedValue(null);
    mockReturning.mockResolvedValue([
      {
        id: 'artifact-1',
        filename: 'notes.md',
        mimeType: 'text/markdown',
        sizeBytes: 12,
      },
    ]);
  });

  it('accepts a .md file when File.type is empty (Windows path) and persists mimeType=text/markdown', async () => {
    const file = new File(['# notes\nbody'], 'notes.md', { type: '' });
    const res = await POST(makeMultipartRequest(file), { params });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { mimeType: string };
    expect(body.mimeType).toBe('text/markdown');

    // Persisted mime is the canonical 'text/markdown' — never the raw
    // empty string from file.type.
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'notes.md',
        mimeType: 'text/markdown',
      }),
    );

    // MinIO ContentType is also the canonical mime.
    expect(putObjectArgs[0]?.ContentType).toBe('text/markdown');

    // Both extract helpers received the canonical mime, not the raw file.type.
    expect(mockExtractAttachment).toHaveBeenCalledWith(
      expect.any(Buffer),
      'text/markdown',
    );
    expect(mockExtractImageDescription).toHaveBeenCalledWith(
      expect.any(Buffer),
      'text/markdown',
    );
  });

  it('accepts a .md file when File.type is application/octet-stream', async () => {
    const file = new File(['hello'], 'README.md', {
      type: 'application/octet-stream',
    });
    const res = await POST(makeMultipartRequest(file), { params });

    expect(res.status).toBe(200);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'text/markdown' }),
    );
  });

  it('still rejects disallowed extensions (.zip) when file.type is empty — extension fallback only widens the existing allowlist', async () => {
    const file = new File(['zipdata'], 'archive.zip', { type: '' });
    const res = await POST(makeMultipartRequest(file), { params });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unsupported type' });
    expect(mockMinioSend).not.toHaveBeenCalled();
    expect(mockValues).not.toHaveBeenCalled();
  });

  it('still rejects when file.type names a disallowed mime explicitly', async () => {
    const file = new File(['exe'], 'binary.exe', {
      type: 'application/x-msdownload',
    });
    const res = await POST(makeMultipartRequest(file), { params });

    expect(res.status).toBe(400);
    expect(mockValues).not.toHaveBeenCalled();
  });

  it('preserves the standard happy path for an image with a real browser-supplied mime', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', {
      type: 'image/png',
    });
    mockExtractAttachment.mockResolvedValue(null);
    mockExtractImageDescription.mockResolvedValue('a photo of a thing');
    mockReturning.mockResolvedValue([
      {
        id: 'artifact-2',
        filename: 'photo.png',
        mimeType: 'image/png',
        sizeBytes: 3,
      },
    ]);

    const res = await POST(makeMultipartRequest(file), { params });
    expect(res.status).toBe(200);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'image/png',
        description: 'a photo of a thing',
      }),
    );
    expect(putObjectArgs[0]?.ContentType).toBe('image/png');
  });
});
