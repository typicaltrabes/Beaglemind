import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the litellm-client module so generateRunTitle uses a stubbed completer.
vi.mock('./litellm-client', () => ({
  liteLLMComplete: vi.fn(),
  LiteLLMError: class LiteLLMError extends Error {},
}));

// Mock the tenant DB so we can capture update() calls.
const whereSpy = vi.fn().mockResolvedValue([]);
const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
const updateSpy = vi.fn().mockReturnValue({ set: setSpy });
vi.mock('@/lib/get-tenant', () => ({
  getTenantDb: () => ({
    db: { update: updateSpy },
    schema: { runs: { id: 'runs.id', title: 'runs.title' } },
  }),
}));

import { truncatePrompt, generateRunTitle, RUN_TITLE_SYSTEM_PROMPT } from './run-title';
import { liteLLMComplete } from './litellm-client';

describe('truncatePrompt', () => {
  it('returns the input unchanged when shorter than max', () => {
    expect(truncatePrompt('hello world', 80)).toBe('hello world');
  });
  it('returns empty for empty input', () => {
    expect(truncatePrompt('', 80)).toBe('');
  });
  it('appends ellipsis when truncated', () => {
    expect(truncatePrompt('a'.repeat(82), 80)).toBe('a'.repeat(80) + '…');
  });
  it('does not append ellipsis at exact boundary', () => {
    expect(truncatePrompt('a'.repeat(80), 80)).toBe('a'.repeat(80));
  });
  it('truncates at small max', () => {
    expect(truncatePrompt('hello world', 5)).toBe('hello…');
  });
});

describe('RUN_TITLE_SYSTEM_PROMPT', () => {
  it('contains "6-8 words" and "no quotes" instructions', () => {
    expect(RUN_TITLE_SYSTEM_PROMPT).toMatch(/6-8 words/);
    expect(RUN_TITLE_SYSTEM_PROMPT).toMatch(/no quotes/i);
  });
});

describe('generateRunTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a sanitized title via the tenant DB on success', async () => {
    (liteLLMComplete as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue('  "Quick analysis of TSLA"  ');
    await generateRunTitle({
      runId: 'run-1',
      prompt: 'Look at TSLA fundamentals',
      tenantId: 'tenant-x',
    });
    expect(setSpy).toHaveBeenCalledWith({ title: 'Quick analysis of TSLA' });
  });

  it('does not throw when liteLLMComplete throws', async () => {
    (liteLLMComplete as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('boom'));
    await expect(
      generateRunTitle({ runId: 'r', prompt: 'p', tenantId: 't' }),
    ).resolves.toBeUndefined();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('skips DB write when prompt is whitespace-only', async () => {
    await generateRunTitle({ runId: 'r', prompt: '   \n\t  ', tenantId: 't' });
    expect(liteLLMComplete).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('skips DB write when sanitized result is empty', async () => {
    (liteLLMComplete as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue('   ""   ');
    await generateRunTitle({ runId: 'r', prompt: 'p', tenantId: 't' });
    expect(setSpy).not.toHaveBeenCalled();
  });
});
