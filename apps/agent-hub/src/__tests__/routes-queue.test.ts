/**
 * Phase 19-05 — runRoundTable consumes mid-round queued messages at start of
 * round 2+ AND clears runs.current_round at exit.
 *
 * Behaviors verified:
 *   1. With one event marked `metadata.queuedForNextRound = true`, round 2's
 *      first agent prompt contains the queued text under a `User:` prefix in
 *      the GROUP DISCUSSION block.
 *   2. With TWO queued events (sequence-ordered), they concatenate in send-
 *      order under a single `User:` prefix joined by `\n\n`.
 *   3. With one queued event AND roundCount=1, the queue is NOT consumed
 *      (round 1 has no queue read — the original user prompt IS the round-1
 *      input; queued messages target round 2+ by definition).
 *   4. After consumption, an UPDATE statement runs that clears the
 *      queuedForNextRound flag (jsonb_set or equivalent SQL fragment).
 *   5. After the rounds loop exits, an UPDATE on runs sets
 *      currentRound: null (so the messages route can distinguish post-round
 *      idle from round-in-flight state).
 *
 * Pattern follows routes-multi-round.test.ts: mock sendToAgent and
 * @beagle-console/db so the unit under test is observable without a real
 * CLI bridge or DB. db.execute is also mocked because the queue-clear path
 * uses raw SQL (jsonb_set) via db.execute(sql`...`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../connections/openclaw-cli-bridge', () => ({
  sendToAgent: vi.fn(async () => null),
}));

vi.mock('../connections/anthropic-vision-bridge', () => ({
  sendToAgentWithVision: vi.fn(async () => null),
}));

const { updateSpy, updateSetSpy, limitSpy, executeSpy } = vi.hoisted(() => {
  const updateSetSpy = vi.fn((_setArg: Record<string, unknown>) => ({
    where: vi.fn(async () => undefined),
  }));
  const updateSpy = vi.fn((_table: unknown) => ({ set: updateSetSpy }));
  const limitSpy = vi.fn(async () => [
    { roundCount: 2, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
  ]);
  const executeSpy = vi.fn(async () => undefined);
  return { updateSpy, updateSetSpy, limitSpy, executeSpy };
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
    execute: executeSpy,
  },
  createTenantSchema: vi.fn(() => ({ runs: { id: 'id' }, events: { id: 'id' } })),
}));

import { runRoundTable } from '../http/routes';
import { sendToAgent } from '../connections/openclaw-cli-bridge';

const mockedSendToAgent = vi.mocked(sendToAgent);

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
  let seq = 100;
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

/** Build a queued user event envelope (as eventStore.list would return). */
function buildQueuedUserEvent(seq: number, text: string) {
  return {
    type: 'agent_message',
    agentId: 'user',
    runId: RUN_ID,
    tenantId: TENANT_ID,
    sequenceNumber: seq,
    content: { text },
    metadata: { queuedForNextRound: true },
    timestamp: '2026-04-30T00:00:00.000Z',
  };
}

describe('runRoundTable: queued-message consumption (Plan 19-05)', () => {
  beforeEach(() => {
    mockedSendToAgent.mockReset();
    updateSpy.mockClear();
    updateSetSpy.mockClear();
    executeSpy.mockClear();
    limitSpy.mockReset();
    // Default: roundCount=2 (so we have round 1 + round 2 to observe queue
    // consumption between them), no inter-round pause.
    limitSpy.mockResolvedValue([
      { roundCount: 2, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
    ]);
  });

  it('consumes one queued message at start of round 2', async () => {
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const round = Math.floor(callIdx / 3) + 1;
      const agentId = order[callIdx % 3]!;
      callIdx++;
      return reply(agentId, round);
    });

    const router = buildRouterMock();
    // eventStore.list returns the queued user event (sequenced before any
    // round-1 replies, since the user posted it during round 1's flight).
    const eventStore = {
      list: vi.fn(async () => [buildQueuedUserEvent(5, 'mid-round message')]),
    } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Initial prompt',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // 6 sendToAgent calls (3 agents x 2 rounds). Round 2's first agent (mo) is
    // call index 3 — that's where the queued block must show up.
    expect(mockedSendToAgent).toHaveBeenCalledTimes(6);
    const moRound2Prompt = (mockedSendToAgent.mock.calls[3]?.[1] ?? '') as string;

    // The queued message appears under a `User:` prefix inside the round-2
    // GROUP DISCUSSION block. The literal text from the queued event must
    // appear in the prompt.
    expect(moRound2Prompt).toContain('User: mid-round message');

    // Round 1's first-agent prompt (call 0) has its OWN `User: Initial prompt`
    // line — but does NOT contain the queued text.
    const moRound1Prompt = (mockedSendToAgent.mock.calls[0]?.[1] ?? '') as string;
    expect(moRound1Prompt).not.toContain('mid-round message');
  });

  it('concatenates multiple queued messages in send-order under one User: prefix', async () => {
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const round = Math.floor(callIdx / 3) + 1;
      const agentId = order[callIdx % 3]!;
      callIdx++;
      return reply(agentId, round);
    });

    const router = buildRouterMock();
    // Two queued user events, sequence-ordered (5 then 6 — the order list()
    // returns them in, ASC by sequenceNumber).
    const eventStore = {
      list: vi.fn(async () => [
        buildQueuedUserEvent(5, 'msg-A'),
        buildQueuedUserEvent(6, 'msg-B'),
      ]),
    } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Initial prompt',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    const moRound2Prompt = (mockedSendToAgent.mock.calls[3]?.[1] ?? '') as string;
    // Single User: prefix, both texts joined by \n\n in send-order.
    expect(moRound2Prompt).toContain('User: msg-A\n\nmsg-B');
    // Sanity: only ONE `User:` line for the queued block (not two), so no
    // double-prefixed `User: msg-A\n\nUser: msg-B` shape.
    const matches = (moRound2Prompt.match(/User: msg-/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it('does NOT consume queued messages on round 1', async () => {
    // roundCount=1 so the only call is the round-1 first agent.
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
    const eventStore = {
      list: vi.fn(async () => [buildQueuedUserEvent(5, 'queued-but-skipped')]),
    } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Initial prompt',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // The queue-consumption path is what this plan introduces. With roundCount=1
    // there is no round 2, so consumeQueuedMessages must NEVER fire. We
    // observe that via `db.execute` (the jsonb_set UPDATE that clears the
    // queuedForNextRound flag) — on round 1 there is no queue read AND no
    // queue clear.
    //
    // (The pre-existing PRIOR CONVERSATION block at the top of runRoundTable
    // independently lists ALL prior user events as `User: <text>` lines —
    // that's Plan 17.1-07 behavior, not this plan's concern. The queued-event
    // text may show up in PRIOR CONVERSATION; what this plan guarantees is
    // that round 1 does NOT do the queue-consume + flag-clear cycle.)
    expect(executeSpy).not.toHaveBeenCalled();
    // The injected queue marker `User: queued-but-skipped\n\nUser: <prompt>`
    // shape (which is what consumeQueuedMessages would emit) must NOT appear
    // — verify by checking that no GROUP DISCUSSION block appears on round 1
    // (transcript empty for the first agent, so format A is used: "User: prompt").
    const moRound1Prompt = (mockedSendToAgent.mock.calls[0]?.[1] ?? '') as string;
    expect(moRound1Prompt).not.toContain('--- GROUP DISCUSSION ---');
  });

  it('clears queuedForNextRound flag after consumption', async () => {
    let callIdx = 0;
    const order = ['mo', 'jarvis', 'herman'];
    mockedSendToAgent.mockImplementation(async () => {
      const round = Math.floor(callIdx / 3) + 1;
      const agentId = order[callIdx % 3]!;
      callIdx++;
      return reply(agentId, round);
    });

    const router = buildRouterMock();
    const eventStore = {
      list: vi.fn(async () => [buildQueuedUserEvent(5, 'mid-round message')]),
    } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Initial prompt',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // db.execute fired exactly once (the UPDATE that clears the flag at the
    // start of round 2). The argument is a Drizzle SQL fragment — drizzle
    // builds it as an opaque object but exposes `.queryChunks` / `.toString()`.
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('clears runs.current_round on rounds-loop exit', async () => {
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
      'Test current_round clear at exit',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // updateSetSpy was called multiple times during the rounds (once per round
    // for current_round=N). EXACTLY ONE of those calls sets currentRound: null —
    // the post-rounds-loop clear.
    const clearCalls = updateSetSpy.mock.calls.filter((call) => {
      const arg = call[0];
      return arg && arg.currentRound === null;
    });
    expect(clearCalls).toHaveLength(1);
  });
});
