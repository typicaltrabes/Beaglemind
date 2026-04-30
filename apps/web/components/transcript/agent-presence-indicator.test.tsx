// @vitest-environment happy-dom

/**
 * Phase 19-03 (UX-19-05): AgentPresenceIndicator render tests.
 *
 * Pins the visual + a11y contract for the inline `Mo is thinking…` indicator
 * that renders at the bottom of the transcript while a presence_thinking_start
 * is active for the named agent. Must be visually distinct from a real
 * agent_message bubble (italic muted text + 3 staggered animated dots), and
 * announce politely to screen readers.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentPresenceIndicator } from './agent-presence-indicator';

describe('AgentPresenceIndicator', () => {
  it('renders capitalized agent name + thinking text', () => {
    render(<AgentPresenceIndicator agentId="mo" />);
    expect(screen.getByText(/Mo is thinking/i)).toBeInTheDocument();
  });

  it('renders three animated dots with staggered delay classes', () => {
    const { container } = render(<AgentPresenceIndicator agentId="jarvis" />);
    const dots = container.querySelectorAll('.presence-dot');
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveClass('presence-dot-1');
    expect(dots[1]).toHaveClass('presence-dot-2');
    expect(dots[2]).toHaveClass('presence-dot-3');
  });

  it('has role=status + aria-live=polite for screen readers', () => {
    render(<AgentPresenceIndicator agentId="herman" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('returns null when agentId is empty', () => {
    const { container } = render(<AgentPresenceIndicator agentId="" />);
    expect(container.firstChild).toBeNull();
  });
});
