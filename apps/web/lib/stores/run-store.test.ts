/**
 * Phase 19-03 (UX-19-05) — run-store presence tracking tests.
 *
 * Verifies the `thinkingAgent: string | null` slice that drives the inline
 * AgentPresenceIndicator at the bottom of the transcript:
 *   1. presence_thinking_start sets thinkingAgent to envelope.agentId.
 *   2. matching presence_thinking_end clears thinkingAgent to null.
 *   3. mismatched _end (stale end after new start) is a no-op — protects
 *      against the SSE replay race where end-A arrives after start-B.
 *   4. agent_message from the SAME agent clears thinkingAgent early —
 *      defense in depth against a dropped _end.
 *   5. last-writer-wins: a second _start (different agent) before the first
 *      _end overwrites thinkingAgent — prevents stuck indicators on overlap.
 *   6. presence events do NOT pollute events/eventOrder — they're a UI-only
 *      slice; the SSE replay would re-fire them on reconnect, but the
 *      transcript doesn't need them as items.
 *   7. initRun resets thinkingAgent to null — switching runs must clear.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useRunStore } from './run-store';
import type { HubEventEnvelope } from '@beagle-console/shared';

const RUN_ID = '6e8a4c12-9b3d-4f25-8a17-2c5b0d8a9e44';
const TENANT_ID = 'a5e7f2c1-0b89-4d6a-b3e2-1c9f8a4d7b56';

let seq = 0;
function buildEnvelope(
  type: HubEventEnvelope['type'],
  agentId: string,
  content: Record<string, unknown> = {},
): HubEventEnvelope {
  seq++;
  return {
    type,
    agentId,
    runId: RUN_ID,
    tenantId: TENANT_ID,
    sequenceNumber: seq,
    content,
    metadata: {},
    timestamp: new Date(2026, 3, 30, 12, 0, seq).toISOString(),
  };
}

describe('run-store: presence tracking (Plan 19-03)', () => {
  beforeEach(() => {
    seq = 0;
    useRunStore.getState().initRun(RUN_ID);
  });

  it('sets thinkingAgent on presence_thinking_start', () => {
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'mo'));
    expect(useRunStore.getState().thinkingAgent).toBe('mo');
  });

  it('clears thinkingAgent on matching presence_thinking_end', () => {
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'mo'));
    expect(useRunStore.getState().thinkingAgent).toBe('mo');

    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_end', 'mo'));
    expect(useRunStore.getState().thinkingAgent).toBeNull();
  });

  it('does NOT clear on mismatched _end (stale end after new start)', () => {
    // First mo starts thinking, then jarvis takes over. The stale end-mo
    // arrives later — it must NOT clear jarvis.
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'mo'));
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'jarvis'));
    expect(useRunStore.getState().thinkingAgent).toBe('jarvis');

    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_end', 'mo'));
    expect(useRunStore.getState().thinkingAgent).toBe('jarvis');
  });

  it('clears thinkingAgent when matching agent_message arrives', () => {
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'mo'));
    expect(useRunStore.getState().thinkingAgent).toBe('mo');

    useRunStore
      .getState()
      .appendEvent(buildEnvelope('agent_message', 'mo', { text: 'hi' }));
    expect(useRunStore.getState().thinkingAgent).toBeNull();
  });

  it('last-writer-wins when a second _start arrives before _end', () => {
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'mo'));
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'jarvis'));
    expect(useRunStore.getState().thinkingAgent).toBe('jarvis');
  });

  it('presence events are NOT added to events/eventOrder', () => {
    const before = useRunStore.getState().eventOrder.length;
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'mo'));
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_end', 'mo'));
    expect(useRunStore.getState().eventOrder.length).toBe(before);
    // events map is also untouched
    expect(Object.keys(useRunStore.getState().events).length).toBe(0);
  });

  it('initRun resets thinkingAgent to null', () => {
    useRunStore
      .getState()
      .appendEvent(buildEnvelope('presence_thinking_start', 'mo'));
    expect(useRunStore.getState().thinkingAgent).toBe('mo');

    useRunStore.getState().initRun('different-run-id');
    expect(useRunStore.getState().thinkingAgent).toBeNull();
  });
});
