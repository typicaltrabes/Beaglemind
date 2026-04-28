import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploadAttachment, AttachmentUploadError } from './attachment-upload';

describe('uploadAttachment', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on a 200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          artifactId: 'art-123',
          filename: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1234,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const file = new File(['hi'], 'doc.pdf', { type: 'application/pdf' });
    const out = await uploadAttachment('run-uuid', file);

    expect(out).toEqual({
      artifactId: 'art-123',
      filename: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/runs/run-uuid/attachments');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    // Browser must set the multipart boundary; we MUST NOT set Content-Type ourselves.
    expect(init.headers).toBeUndefined();
  });

  it('attaches the file under the "file" form field', async () => {
    let captured: FormData | undefined;
    const fetchMock = vi.fn().mockImplementation(async (_url, init?: RequestInit) => {
      captured = init?.body as FormData;
      return new Response(
        JSON.stringify({
          artifactId: 'a',
          filename: 'f.txt',
          mimeType: 'text/plain',
          sizeBytes: 0,
        }),
        { status: 200 },
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const file = new File(['x'], 'f.txt', { type: 'text/plain' });
    await uploadAttachment('r', file);

    expect(captured).toBeInstanceOf(FormData);
    const got = captured!.get('file');
    expect(got).toBeInstanceOf(File);
    expect((got as File).name).toBe('f.txt');
  });

  it('throws AttachmentUploadError with status 400 and message from error field', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'unsupported type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const file = new File(['x'], 'f.bin', { type: 'application/octet-stream' });
    await expect(uploadAttachment('r', file)).rejects.toMatchObject({
      name: 'AttachmentUploadError',
      status: 400,
      message: 'unsupported type',
    });
  });

  it('throws AttachmentUploadError on 500 falling back to statusText when error field absent', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    ) as unknown as typeof fetch;

    const file = new File(['x'], 'f.txt', { type: 'text/plain' });
    let thrown: unknown;
    try {
      await uploadAttachment('r', file);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AttachmentUploadError);
    const e = thrown as AttachmentUploadError;
    expect(e.status).toBe(500);
    // Falls back to statusText when JSON body has no `error` field (or fails to parse).
    expect(e.message.length).toBeGreaterThan(0);
  });

  it('AttachmentUploadError extends Error and exposes a public status property', () => {
    const e = new AttachmentUploadError(413, 'too large');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(413);
    expect(e.message).toBe('too large');
    expect(e.name).toBe('AttachmentUploadError');
  });
});
