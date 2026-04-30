/**
 * Phase 19-01 — runRoundTable multi-round flow tests.
 *
 * Verifies the substrate change: runRoundTable now wraps mo->jarvis->herman in
 * an outer N-rounds loop (default N=3), accumulates the transcript across
 * rounds, emits state_transition events between rounds, and DOES NOT mark
 * the run completed at the end (that responsibility moves to Plan 19-02's
 * idle-timeout watcher).
 *
 * Behaviors covered:
 *   1. With round_count=3 and 3 mocked replies/round, sendToAgent is called
 *      EXACTLY 9 times (3 agents * 3 rounds).
 *   2. Round 2's first agent (mo) sees every round-1 reply (mo, jarvis,
 *      herman) inside the GROUP DISCUSSION block.
 *   3. Between rounds k and k+1, exactly one state_transition event is
 *      published with content.from='round-k', content.to='round-(k+1)'.
 *   4. NO state_transition with content.to='completed' is emitted.
 *   5. NO db.update with status='completed' is performed.
 *   6. Vision pass-through fires on round 1 ONLY for vision-capable agents
 *      (mo, jarvis); rounds 2+ go through sendToAgent text-only.
 *   7. All-failed round still continues to next round (round still counts
 *      toward N; one warn line per all-fail round).
 *
 * Pattern follows routes-history.test.ts: mock sendToAgent and
 * @beagle-console/db so the unit under test is observable without a real
 * CLI bridge or DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../connections/openclaw-cli-bridge', () => ({
  sendToAgent: vi.fn(async () => null),
}));

vi.mock('../connections/anthropic-vision-bridge', () => ({
  sendToAgentWithVision: vi.fn(async () => null),
}));

// Configurable db mock: tests inject roundCount via mockReturn before calling
// runRoundTable. db.update is also tracked so test 5 can assert NO call with
// status: 'completed' is made.
//
// vi.hoisted lets us declare the spies at the top of the test module and
// reference them inside the (hoisted) vi.mock factory. Without hoisted, the
// const declarations would be reordered by Vitest under the import and the
// factory would see them as undefined.
const { updateSpy, updateSetSpy, limitSpy } = vi.hoisted(() => {
  const updateSetSpy = vi.fn((_setArg: Record<string, unknown>) => ({
    where: vi.fn(async () => undefined),
  }));
  const updateSpy = vi.fn((_table: unknown) => ({ set: updateSetSpy }));
  const limitSpy = vi.fn(async () => [
    { roundCount: 3, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
  ]);
  return { updateSpy, updateSetSpy, limitSpy };
});

vi.mock('@beagle-console/db', () => ({
  db: {
    update: updateSpy,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: limitSpy,
        })),
      })),
    })),
  },
  createTenantSchema: vi.fn(() => ({ runs: { id: 'id' } })),
}));

import { runRoundTable } from '../http/routes';
import { sendToAgent } from '../connections/openclaw-cli-bridge';
import { sendToAgentWithVision } from '../connections/anthropic-vision-bridge';

const mockedSendToAgent = vi.mocked(sendToAgent);
const mockedSendToAgentWithVision = vi.mocked(sendToAgentWithVision);

const RUN_ID = '6e8a4c12-9b3d-4f25-8a17-2c5b0d8a9e44';
const TENANT_ID = 'a5e7f2c1-0b89-4d6a-b3e2-1c9f8a4d7b56';

interface PersistedEvent {
  tenantId: string;
  type: string;
  agentId: string;
  runId: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

function buildRouterMock(): {
  persistAndPublish: ReturnType<typeof vi.fn>;
  recorded: PersistedEvent[];
} {
  const recorded: PersistedEvent[] = [];
  let seq = 1;
  const persistAndPublish = vi.fn(async (tenantId: string, evt: any) => {
    recorded.push({ tenantId, ...evt });
    return {
      ...evt,
      tenantId,
      sequenceNumber: seq++,
      timestamp: '2026-04-30T00:00:00.000Z',
    };
  });
  return { persistAndPublish, recorded };
}

/** Helper: build a successful sendToAgent reply for a given agent + round. */
function reply(agentId: string, round: number) {
  return {
    text: `${agentId}-r${round}-text`,
    runId: RUN_ID,
    durationMs: 100,
    costUsd: 0,
    model: 'test-model',
  };
}

describe('runRoundTable: multi-round flow (Plan 19-01)', () => {
  beforeEach(() => {
    mockedSendToAgent.mockReset();
    mockedSendToAgentWithVision.mockReset();
    updateSpy.mockClear();
    updateSetSpy.mockClear();
    limitSpy.mockReset();
    // Default: roundCount=3, no inter-round pause to keep tests fast.
    limitSpy.mockResolvedValue([
      { roundCount: 3, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
    ]);
  });

  it('runs N=3 rounds with mo, jarvis, herman per round (sendToAgent called exactly 9 times)', async () => {
    // Each call returns a unique text so transcript accumulation is observable.
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const round = Math.floor(callIdx / 3) + 1;
      const agentId = order[callIdx % 3]!;
      callIdx++;
      return reply(agentId, round);
    });

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Multi-round prompt',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // 3 agents x 3 rounds = 9 calls
    expect(mockedSendToAgent).toHaveBeenCalledTimes(9);

    // agent_message events: 9 (one per agent per round) — no failure markers
    const agentMessages = router.recorded.filter(
      (e) => e.type === 'agent_message',
    );
    expect(agentMessages).toHaveLength(9);

    // Order check: mo r1, jarvis r1, herman r1, mo r2, jarvis r2, herman r2,
    // mo r3, jarvis r3, herman r3
    const expected = [
      ['mo', 1], ['jarvis', 1], ['herman', 1],
      ['mo', 2], ['jarvis', 2], ['herman', 2],
      ['mo', 3], ['jarvis', 3], ['herman', 3],
    ] as const;
    expected.forEach(([agentId, round], i) => {
      const msg = agentMessages[i]!;
      expect(msg.agentId).toBe(agentId);
      expect((msg.metadata as any).round).toBe(round);
    });
  });

  it("round 2's first agent sees round-1 transcript in GROUP DISCUSSION block", async () => {
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const round = Math.floor(callIdx / 3) + 1;
      const agentId = order[callIdx % 3]!;
      callIdx++;
      return reply(agentId, round);
    });

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Test transcript accumulation',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // sendToAgent calls in order:
    //   call[0] = mo r1   (transcript empty)
    //   call[1] = jarvis r1
    //   call[2] = herman r1
    //   call[3] = mo r2   <-- this is the assertion target
    //   call[4] = jarvis r2
    //   call[5] = herman r2
    //   call[6] = mo r3
    //   ...
    expect(mockedSendToAgent).toHaveBeenCalledTimes(9);

    const moRound2Prompt = (mockedSendToAgent.mock.calls[3]?.[1] ?? '') as string;
    expect(moRound2Prompt).toContain('--- GROUP DISCUSSION ---');
    expect(moRound2Prompt).toContain('Mo: mo-r1-text');
    expect(moRound2Prompt).toContain('Jarvis: jarvis-r1-text');
    expect(moRound2Prompt).toContain('Herman: herman-r1-text');
  });

  it('emits state_transition events between rounds (round-1 -> round-2, round-2 -> round-3) but NOT after the last round', async () => {
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const round = Math.floor(callIdx / 3) + 1;
      const agentId = order[callIdx % 3]!;
      callIdx++;
      return reply(agentId, round);
    });

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Test inter-round transitions',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    const transitions = router.recorded.filter(
      (e) => e.type === 'state_transition',
    );
    // Exactly 2 transitions (between r1->r2 and r2->r3); the last round has no
    // following transition.
    expect(transitions).toHaveLength(2);
    expect(transitions[0]!.content).toEqual({ from: 'round-1', to: 'round-2' });
    expect(transitions[1]!.content).toEqual({ from: 'round-2', to: 'round-3' });
  });

  it('does NOT emit state_transition: executing -> completed at end (Plan 19-02 owns completion)', async () => {
    mockedSendToAgent.mockResolvedValue(reply('mo', 1));

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'No auto-complete transition',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    const completedTransitions = router.recorded.filter(
      (e) =>
        e.type === 'state_transition' &&
        ((e.content as any)?.to === 'completed' ||
          (e.content as any)?.from === 'executing'),
    );
    expect(completedTransitions).toHaveLength(0);
  });

  it('does NOT write status=completed to runs at end (Plan 19-02 owns completion)', async () => {
    mockedSendToAgent.mockResolvedValue(reply('mo', 1));

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'No auto-complete db write',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // db.update IS called for current_round bookkeeping (3x — once per round).
    // But NEVER with status: 'completed'. Inspect every .set() argument.
    expect(updateSetSpy).toHaveBeenCalled();
    for (const call of updateSetSpy.mock.calls) {
      const setArg = call[0];
      expect(setArg).not.toHaveProperty('status');
    }
  });

  it('round 1 forwards imageAttachments to sendToAgentWithVision; rounds 2+ do not', async () => {
    // Vision bridge succeeds for mo + jarvis on round 1; herman is not
    // vision-capable so falls through to sendToAgent text-only.
    mockedSendToAgentWithVision.mockImplementation(async ({ agentId }) => ({
      text: `${agentId}-vision-r1`,
      runId: RUN_ID,
      durationMs: 50,
      costUsd: 0,
      model: 'claude-vision',
    }));
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const reply_ = reply(order[callIdx % 3]!, Math.floor(callIdx / 3) + 1);
      callIdx++;
      return reply_;
    });

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    const imageAttachments = [
      { filename: 'deal.jpg', mimeType: 'image/jpeg', base64: 'AAAA' },
    ];

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'A prompt with an image',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
      imageAttachments,
    );

    // Vision called only on round 1 for vision-capable agents (mo, jarvis).
    expect(mockedSendToAgentWithVision).toHaveBeenCalledTimes(2);
    // Both vision-bridge invocations should be on round 1's prompts (no
    // explicit round arg passed; we verify by inspecting the prompt — round
    // 1 first agent has no GROUP DISCUSSION block).
    for (const call of mockedSendToAgentWithVision.mock.calls) {
      const promptArg = (call[1] ?? '') as string;
      // Round 1 mo's prompt does NOT contain GROUP DISCUSSION (transcript empty)
      // Round 1 jarvis's prompt contains GROUP DISCUSSION (mo just replied)
      // Either way, the agentId is mo or jarvis — confirm via the {agentId} arg.
      expect(['mo', 'jarvis']).toContain((call[0] as any).agentId);
      expect(promptArg.length).toBeGreaterThan(0);
    }
    // sendToAgent (text-only) called 7 times total:
    //   round 1: herman (1)
    //   round 2: mo, jarvis, herman (3)
    //   round 3: mo, jarvis, herman (3)
    expect(mockedSendToAgent).toHaveBeenCalledTimes(7);
  });

  it('all-failed round still continues to next round + still counts toward N', async () => {
    // First 3 calls (round 1) all return null. Calls 4-9 succeed.
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const round = Math.floor(callIdx / 3) + 1;
      const agentId = order[callIdx % 3]!;
      callIdx++;
      if (round === 1) return null;
      return reply(agentId, round);
    });

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Test all-fail round still counts',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // All 9 calls were made — round 2 + round 3 still ran after the all-fail
    // round 1.
    expect(mockedSendToAgent).toHaveBeenCalledTimes(9);

    // Round 1 produced 3 failure-bubble events (one per agent). Round 2 + 3
    // produced 6 normal agent_message events. Total agent_message: 9 (3
    // failure markers + 6 real replies).
    const agentMessages = router.recorded.filter(
      (e) => e.type === 'agent_message',
    );
    expect(agentMessages).toHaveLength(9);
    const failureMarkers = agentMessages.filter(
      (e) => (e.metadata as any)?.errorKind === 'agent_failure',
    );
    expect(failureMarkers).toHaveLength(3);
    // All failure markers are tagged with round=1
    failureMarkers.forEach((m) => {
      expect((m.metadata as any).round).toBe(1);
    });

    // 2 inter-round state_transitions still emitted (round-1 -> round-2,
    // round-2 -> round-3). The all-failed round still counts toward N.
    const transitions = router.recorded.filter(
      (e) => e.type === 'state_transition',
    );
    expect(transitions).toHaveLength(2);
    expect(transitions[0]!.content).toEqual({ from: 'round-1', to: 'round-2' });
    expect(transitions[1]!.content).toEqual({ from: 'round-2', to: 'round-3' });
  });

  it('with round_count=1, runs single pass and emits NO inter-round state_transition', async () => {
    limitSpy.mockResolvedValue([
      { roundCount: 1, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
    ]);
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const agentId = order[callIdx % 3]!;
      callIdx++;
      return reply(agentId, 1);
    });

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Single round',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    expect(mockedSendToAgent).toHaveBeenCalledTimes(3);
    const transitions = router.recorded.filter(
      (e) => e.type === 'state_transition',
    );
    expect(transitions).toHaveLength(0);
  });
});
