/**
 * Phase 19-03 — runRoundTable presence emission tests (UX-19-05).
 *
 * Verifies that every agent invocation in runRoundTable emits exactly one
 * `presence_thinking_start` immediately before the bridge call and exactly
 * one `presence_thinking_end` immediately after (regardless of success or
 * failure path). The wrap uses try/finally so a synchronous throw inside
 * the bridge call still produces a matching _end.
 *
 * Behaviors covered (Plan 19-03 Task 1):
 *   1. Single-round flow (3 agents, all succeed): exactly 3 _start + 3 _end
 *      events emitted. Order invariant: for each agent, _start strictly
 *      precedes the agent_message and _end strictly follows.
 *   2. Throw-path: when sendToAgent throws for one agent, _end still fires
 *      (try/finally), the failure-bubble agent_message is published, and
 *      the loop continues to the next agent.
 *   3. Three-round flow (3 agents x 3 rounds): exactly 9 _start + 9 _end
 *      events are emitted (18 presence events total).
 *
 * Pattern follows routes-multi-round.test.ts (mock the CLI bridge + DB so
 * the unit under test is observable without real infra).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../connections/openclaw-cli-bridge', () => ({
  sendToAgent: vi.fn(async () => null),
}));

vi.mock('../connections/anthropic-vision-bridge', () => ({
  sendToAgentWithVision: vi.fn(async () => null),
}));

const { updateSpy, updateSetSpy, limitSpy } = vi.hoisted(() => {
  const updateSetSpy = vi.fn((_setArg: Record<string, unknown>) => ({
    where: vi.fn(async () => undefined),
  }));
  const updateSpy = vi.fn((_table: unknown) => ({ set: updateSetSpy }));
  const limitSpy = vi.fn(async () => [
    { roundCount: 1, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
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

function reply(agentId: string, round: number) {
  return {
    text: `${agentId}-r${round}-text`,
    runId: RUN_ID,
    durationMs: 100,
    costUsd: 0,
    model: 'test-model',
  };
}

describe('runRoundTable: presence emission (Plan 19-03)', () => {
  beforeEach(() => {
    mockedSendToAgent.mockReset();
    mockedSendToAgentWithVision.mockReset();
    updateSpy.mockClear();
    updateSetSpy.mockClear();
    limitSpy.mockReset();
    limitSpy.mockResolvedValue([
      { roundCount: 1, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
    ]);
  });

  it('emits presence_thinking_start + _end around every agent call (single round, 3 agents)', async () => {
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
      'Single round presence test',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    const starts = router.recorded.filter(
      (e) => e.type === 'presence_thinking_start',
    );
    const ends = router.recorded.filter(
      (e) => e.type === 'presence_thinking_end',
    );
    expect(starts).toHaveLength(3);
    expect(ends).toHaveLength(3);

    // Each agent gets exactly one _start and one _end.
    for (const agentId of order) {
      expect(starts.filter((e) => e.agentId === agentId)).toHaveLength(1);
      expect(ends.filter((e) => e.agentId === agentId)).toHaveLength(1);
    }

    // Order invariant: for each agent, _start index < agent_message index < _end index.
    for (const agentId of order) {
      const startIdx = router.recorded.findIndex(
        (e) => e.type === 'presence_thinking_start' && e.agentId === agentId,
      );
      const msgIdx = router.recorded.findIndex(
        (e) => e.type === 'agent_message' && e.agentId === agentId,
      );
      const endIdx = router.recorded.findIndex(
        (e) => e.type === 'presence_thinking_end' && e.agentId === agentId,
      );
      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(msgIdx).toBeGreaterThan(startIdx);
      expect(endIdx).toBeGreaterThan(msgIdx);
    }

    // Presence events carry a structured content payload identifying themselves.
    expect((starts[0]!.content as any).event).toBe('presence_thinking_start');
    expect((ends[0]!.content as any).event).toBe('presence_thinking_end');
  });

  it('emits presence_thinking_end even when bridge throws (try/finally guard)', async () => {
    // mo + herman succeed; jarvis throws synchronously.
    mockedSendToAgent.mockImplementation(async (cfg: any) => {
      if (cfg.agentId === 'jarvis') {
        throw new Error('simulated bridge failure');
      }
      return reply(cfg.agentId, 1);
    });

    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Throw-path presence test',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // All 3 _start AND all 3 _end events were emitted (jarvis included via finally).
    const starts = router.recorded.filter(
      (e) => e.type === 'presence_thinking_start',
    );
    const ends = router.recorded.filter(
      (e) => e.type === 'presence_thinking_end',
    );
    expect(starts).toHaveLength(3);
    expect(ends).toHaveLength(3);
    expect(starts.find((e) => e.agentId === 'jarvis')).toBeDefined();
    expect(ends.find((e) => e.agentId === 'jarvis')).toBeDefined();

    // The failure-bubble agent_message for jarvis is also present.
    const jarvisFailures = router.recorded.filter(
      (e) =>
        e.type === 'agent_message' &&
        e.agentId === 'jarvis' &&
        (e.metadata as any)?.errorKind === 'agent_failure',
    );
    expect(jarvisFailures).toHaveLength(1);

    // Order: for jarvis, _start < failure-bubble < _end.
    const jStartIdx = router.recorded.findIndex(
      (e) => e.type === 'presence_thinking_start' && e.agentId === 'jarvis',
    );
    const jFailIdx = router.recorded.findIndex(
      (e) =>
        e.type === 'agent_message' &&
        e.agentId === 'jarvis' &&
        (e.metadata as any)?.errorKind === 'agent_failure',
    );
    const jEndIdx = router.recorded.findIndex(
      (e) => e.type === 'presence_thinking_end' && e.agentId === 'jarvis',
    );
    expect(jStartIdx).toBeGreaterThanOrEqual(0);
    expect(jFailIdx).toBeGreaterThan(jStartIdx);
    expect(jEndIdx).toBeGreaterThan(jFailIdx);
  });

  it('over 3 rounds x 3 agents emits exactly 18 presence events (9 starts, 9 ends)', async () => {
    limitSpy.mockResolvedValue([
      { roundCount: 3, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
    ]);

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
      'Three-round presence test',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    const starts = router.recorded.filter(
      (e) => e.type === 'presence_thinking_start',
    );
    const ends = router.recorded.filter(
      (e) => e.type === 'presence_thinking_end',
    );
    expect(starts).toHaveLength(9);
    expect(ends).toHaveLength(9);

    // Each (agentId, round) pair should produce one _start and one _end.
    // We validate counts per agent across all rounds: 3 _start and 3 _end per agent.
    for (const agentId of order) {
      expect(starts.filter((e) => e.agentId === agentId)).toHaveLength(3);
      expect(ends.filter((e) => e.agentId === agentId)).toHaveLength(3);
    }
  });
});
