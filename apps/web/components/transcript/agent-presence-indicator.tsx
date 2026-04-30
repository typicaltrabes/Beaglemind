'use client';

/**
 * Phase 19-03 (UX-19-05): per-agent presence indicator.
 *
 * Renders inline at the bottom of the transcript while a
 * `presence_thinking_start` is active for the named agent. Cleared by the
 * run-store reducer (Plan 19-03 Task 3) on the matching `_end` OR on the
 * agent's actual `agent_message`, whichever first.
 *
 * Visual: italic muted-foreground text + 3 staggered animated dots driven by
 * the `@keyframes presence-dot-pulse` rule in app/globals.css. Distinct from
 * a real agent_message bubble (which has avatar + colored body) so users
 * never confuse a thinking marker with a real reply.
 *
 * Accessibility: role=status + aria-live=polite makes the indicator announce
 * itself politely to screen readers. The dots span carries aria-hidden so
 * the screen reader hears `Mo is thinking` without trailing dot punctuation.
 */
export interface AgentPresenceIndicatorProps {
  agentId: string;
}

export function AgentPresenceIndicator({ agentId }: AgentPresenceIndicatorProps) {
  if (!agentId) return null;
  const display = agentId.charAt(0).toUpperCase() + agentId.slice(1);
  return (
    <div
      role="status"
      aria-live="polite"
      className="px-4 py-2 text-xs italic text-muted-foreground"
      data-testid="agent-presence-indicator"
    >
      {display} is thinking
      <span className="inline-flex gap-0.5 pl-1" aria-hidden="true">
        <span className="presence-dot presence-dot-1">.</span>
        <span className="presence-dot presence-dot-2">.</span>
        <span className="presence-dot presence-dot-3">.</span>
      </span>
    </div>
  );
}
