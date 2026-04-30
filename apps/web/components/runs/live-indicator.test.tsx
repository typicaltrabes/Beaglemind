// @vitest-environment happy-dom

/**
 * Phase 19-04 (UX-19-07) — LiveIndicator render tests.
 *
 * Pins the visual contract for the pulsing brand-orange "Live" pill that
 * renders on the run-detail header AND run-history list rows whenever
 * status === 'executing'. Visually distinct from the agent-roster
 * presence-green dot (orange = run is live; green = agent is online).
 *
 * Pattern follows agent-presence-indicator.test.tsx — happy-dom env, plain
 * Chai matchers, no jest-dom dependency.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveIndicator } from './live-indicator';

describe('LiveIndicator', () => {
  it('renders Live label by default', () => {
    render(<LiveIndicator />);
    const label = screen.getByText('Live');
    expect(label).toBeTruthy();
  });

  it('hides label in compact mode', () => {
    render(<LiveIndicator compact />);
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('uses brand-orange tokens (bg-amber-500/10 outer, text-amber-300 label, animate-ping dot)', () => {
    const { container } = render(<LiveIndicator />);
    const root = container.querySelector('[data-testid="live-indicator"]');
    expect(root).toBeTruthy();
    const cls = root!.className;
    expect(cls).toContain('bg-amber-500/10');
    expect(cls).toContain('text-amber-300');
    // Pulsing dot — animate-ping is the Tailwind utility we rely on for the
    // outer halo. Confirm SOMEWHERE in the rendered tree.
    const ping = container.querySelector('.animate-ping');
    expect(ping).toBeTruthy();
  });
});
