// @vitest-environment happy-dom

/**
 * Phase 19-03 (UX-19-05): AgentPresenceIndicator render tests.
 *
 * Pins the visual + a11y contract for the inline `Mo is thinking…` indicator
 * that renders at the bottom of the transcript while a presence_thinking_start
 * is active for the named agent. Must be visually distinct from a real
 * agent_message bubble (italic muted text + 3 staggered animated dots), and
 * announce politely to screen readers.
 *
 * NOTE: this test file uses plain Chai matchers (not jest-dom) to avoid the
 * type-augmentation wiring that the rest of apps/web has chosen to skip
 * (see user-message-attachments.test.tsx for prior art).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentPresenceIndicator } from './agent-presence-indicator';

describe('AgentPresenceIndicator', () => {
  it('renders capitalized agent name + thinking text', () => {
    render(<AgentPresenceIndicator agentId="mo" />);
    // getByText throws if no match — assertion is the lookup itself.
    const node = screen.getByText(/Mo is thinking/i);
    expect(node).toBeTruthy();
  });

  it('renders three animated dots with staggered delay classes', () => {
    const { container } = render(<AgentPresenceIndicator agentId="jarvis" />);
    const dots = container.querySelectorAll('.presence-dot');
    expect(dots.length).toBe(3);
    expect(dots[0]?.classList.contains('presence-dot-1')).toBe(true);
    expect(dots[1]?.classList.contains('presence-dot-2')).toBe(true);
    expect(dots[2]?.classList.contains('presence-dot-3')).toBe(true);
  });

  it('has role=status + aria-live=polite for screen readers', () => {
    render(<AgentPresenceIndicator agentId="herman" />);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('returns null when agentId is empty', () => {
    const { container } = render(<AgentPresenceIndicator agentId="" />);
    expect(container.firstChild).toBeNull();
  });
});
