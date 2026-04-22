'use client';

import type { HubEventEnvelope } from '@beagle-console/shared';
import { AgentMessage } from './agent-message';
import { PlanCard } from './plan-card';
import { QuestionCard } from './question-card';
import { ArtifactCard } from './artifact-card';

// ---------- State transition (pure presentational) ----------

function StateTransitionMessage({ event }: { event: HubEventEnvelope }) {
  const content = event.content as { from?: string; to?: string };

  return (
    <div className="py-2 text-center">
      <span className="text-xs text-muted-foreground">
        Run transitioned from{' '}
        <span className="font-medium">{content.from}</span> to{' '}
        <span className="font-medium">{content.to}</span>
      </span>
    </div>
  );
}

/**
 * Pure renderer for a single transcript event.
 *
 * Used by MessageList (Writers' Room), Timeline detail panel, and Boardroom
 * columns so that all views render events through a single switch. Returning
 * `null` for unknown types keeps the caller simple — they can always pass the
 * result into a list without a special case.
 */
export function renderEvent(
  event: HubEventEnvelope | undefined,
  runId: string
): React.ReactNode {
  if (!event) return null;
  switch (event.type) {
    case 'plan_proposal':
      return <PlanCard event={event} runId={runId} />;
    case 'question':
      return <QuestionCard event={event} runId={runId} />;
    case 'artifact':
      return <ArtifactCard event={event} />;
    case 'agent_message':
      return <AgentMessage event={event} />;
    case 'state_transition':
      return <StateTransitionMessage event={event} />;
    default:
      return null;
  }
}
