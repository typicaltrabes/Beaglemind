import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock requireTenantContext so the test bypasses Better Auth.
const mockRequireTenantContext = vi.fn();
vi.mock('@/lib/get-tenant', () => ({
  requireTenantContext: () => mockRequireTenantContext(),
}));

// Mock liteLLMComplete so the test never hits the network.
const mockLiteLLMComplete = vi.fn();
vi.mock('@/lib/litellm-client', () => ({
  liteLLMComplete: (input: unknown) => mockLiteLLMComplete(input),
  LiteLLMError: class LiteLLMError extends Error {},
}));

import { POST } from './route';
import { resetRateLimiterForTest } from '@/lib/improve-prompt-rate-limit';
import { LiteLLMError } from '@/lib/litellm-client';

function makeRequest(body: unknown): Request {
  return new Request('http://test/api/runs/improve-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/runs/improve-prompt', () => {
  beforeEach(() => {
    resetRateLimiterForTest();
    vi.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue({
      session: { user: { id: 'user-1' } },
      tenantId: 'tenant-x',
    });
  });

  it('returns 200 + { rewritten } on the happy path', async () => {
    mockLiteLLMComplete.mockResolvedValue('better foo');
    const res = await POST(makeRequest({ prompt: 'foo' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rewritten: 'better foo' });
  });

  it('passes the verbatim CONTEXT system prompt to liteLLMComplete', async () => {
    mockLiteLLMComplete.mockResolvedValue('out');
    await POST(makeRequest({ prompt: 'in' }));
    expect(mockLiteLLMComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(
          "Rewrite the user's prompt to be clearer, better-structured, and more specific.",
        ),
        maxTokens: 800,
        temperature: 0.2,
        timeoutMs: 8000,
      }),
    );
  });

  it('returns 400 for empty prompt', async () => {
    const res = await POST(makeRequest({ prompt: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing prompt field', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 504 with friendly error on LiteLLM timeout', async () => {
    mockLiteLLMComplete.mockRejectedValue(
      new LiteLLMError('LiteLLM claude-haiku timeout after 8000ms'),
    );
    const res = await POST(makeRequest({ prompt: 'p' }));
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      error: 'rewrite timed out — try again',
    });
  });

  it('returns 500 (not 504) for non-timeout LiteLLM errors', async () => {
    mockLiteLLMComplete.mockRejectedValue(new LiteLLMError('HTTP 500 from upstream'));
    const res = await POST(makeRequest({ prompt: 'p' }));
    expect(res.status).toBe(500);
  });

  it('returns 429 on the 31st request in a 60s window for the same user', async () => {
    mockLiteLLMComplete.mockResolvedValue('rewrite');
    for (let i = 0; i < 30; i++) {
      const res = await POST(makeRequest({ prompt: 'p' }));
      expect(res.status).toBe(200);
    }
    const res = await POST(makeRequest({ prompt: 'p' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate limit exceeded' });
  });

  it('isolates rate-limit counts across users', async () => {
    mockLiteLLMComplete.mockResolvedValue('rewrite');
    for (let i = 0; i < 30; i++) {
      mockRequireTenantContext.mockResolvedValueOnce({
        session: { user: { id: 'user-A' } },
        tenantId: 't',
      });
      await POST(makeRequest({ prompt: 'p' }));
    }
    // user-B's first request should still succeed.
    mockRequireTenantContext.mockResolvedValueOnce({
      session: { user: { id: 'user-B' } },
      tenantId: 't',
    });
    const res = await POST(makeRequest({ prompt: 'p' }));
    expect(res.status).toBe(200);
  });
});
