import { describe, it, expect, vi, afterEach } from 'vitest';
import { liteLLMComplete, LiteLLMError } from './litellm-client';

describe('liteLLMComplete', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('returns the assistant message content on a 2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'Generated title' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const out = await liteLLMComplete({
      model: 'claude-haiku',
      system: 'sys',
      user: 'hello',
    });
    expect(out).toBe('Generated title');
  });

  it('throws LiteLLMError on non-2xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(
      liteLLMComplete({ model: 'claude-haiku', system: 's', user: 'u' }),
    ).rejects.toThrowError(LiteLLMError);
  });

  it('throws LiteLLMError when response body is malformed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    );
    await expect(
      liteLLMComplete({ model: 'claude-haiku', system: 's', user: 'u' }),
    ).rejects.toThrowError(/malformed/i);
  });

  it('throws LiteLLMError on timeout (AbortError)', async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      (_url, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            (err as Error & { name: string }).name = 'AbortError';
            reject(err);
          });
        }),
    );
    await expect(
      liteLLMComplete({
        model: 'claude-haiku',
        system: 's',
        user: 'u',
        timeoutMs: 5,
      }),
    ).rejects.toThrowError(/timeout/i);
  });
});
