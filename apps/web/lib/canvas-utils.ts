import type { HubEventEnvelope } from '@beagle-console/shared';

export interface ProximityComment {
  event: HubEventEnvelope;
  position: 'before' | 'at' | 'after';
}

/**
 * Select up to `windowSize` agent_message events closest to `selectedArtifactSeq`
 * by absolute distance in sequenceNumber.
 *
 * - Only considers events where `type === 'agent_message'`. All other event
 *   types (plan_proposal, question, artifact, state_transition, sentinel_flag,
 *   tldr_update, system) are ignored in the proximity window.
 * - Ties at the same absolute distance break to the LOWER sequenceNumber
 *   (deterministic).
 * - Returns entries sorted ascending by `sequenceNumber`.
 * - `position` is 'before' when `event.sequenceNumber < selectedArtifactSeq`,
 *   'at' when equal, 'after' when greater.
 * - Returns `[]` when there are no agent_message events.
 * - Default `windowSize` is 5.
 *
 * This is pure positional proximity — do NOT infer semantic artifact references
 * from message text. See 11-CONTEXT.md §Canvas view, "margin comments".
 */
export function selectProximityComments(
  selectedArtifactSeq: number,
  messages: HubEventEnvelope[],
  windowSize = 5,
): ProximityComment[] {
  const agentMsgs = messages.filter((m) => m.type === 'agent_message');
  if (agentMsgs.length === 0) return [];

  const withDistance = agentMsgs.map((m) => ({
    event: m,
    distance: Math.abs(m.sequenceNumber - selectedArtifactSeq),
  }));

  withDistance.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    // Tie at same distance -> prefer lower sequenceNumber
    return a.event.sequenceNumber - b.event.sequenceNumber;
  });

  const picked = withDistance.slice(0, windowSize);
  picked.sort((a, b) => a.event.sequenceNumber - b.event.sequenceNumber);

  return picked.map(({ event }) => ({
    event,
    position:
      event.sequenceNumber < selectedArtifactSeq
        ? 'before'
        : event.sequenceNumber === selectedArtifactSeq
          ? 'at'
          : 'after',
  }));
}
