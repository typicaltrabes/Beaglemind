// @vitest-environment happy-dom

/**
 * Phase 19-04 (UX-19-03) — ContinueButton render + interaction tests.
 *
 * Pins the visibility/disabled contract for the Continue conversation button
 * on the run-detail page header:
 *
 *   - renders only when status === 'executing'
 *   - disabled while a round is in flight (run-store.thinkingAgent !== null)
 *   - disabled while the underlying mutation is pending
 *   - on click, posts to /api/runs/{runId}/continue
 *
 * Pattern follows agent-presence-indicator.test.tsx + the React Query
 * test wrapper from the @tanstack/react-query docs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContinueButton } from './continue-button';
import { useRunStore } from '@/lib/stores/run-store';

// JSDOM/happy-dom does not provide fetch by default; install a vi.fn we can
// inspect per-test.
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe('ContinueButton', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    // Reset the run-store thinkingAgent slice between tests; the hook reads it
    // synchronously inside the component.
    useRunStore.setState({ thinkingAgent: null });
  });

  it('renders when status is executing', () => {
    render(wrap(<ContinueButton runId="run-1" status="executing" />));
    const btn = screen.getByTestId('continue-button');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Continue conversation/i);
  });

  it('does not render when status is completed', () => {
    const { container } = render(
      wrap(<ContinueButton runId="run-1" status="completed" />),
    );
    expect(container.firstChild).toBeNull();
  });

  it('is disabled while an agent is thinking', () => {
    useRunStore.setState({ thinkingAgent: 'mo' });
    render(wrap(<ContinueButton runId="run-1" status="executing" />));
    const btn = screen.getByTestId('continue-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('posts to /api/runs/[id]/continue on click', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });
    render(wrap(<ContinueButton runId="run-xyz" status="executing" />));
    const btn = screen.getByTestId('continue-button');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/runs/run-xyz/continue', {
        method: 'POST',
      });
    });
  });
});
