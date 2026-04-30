/**
 * Phase 17.1-07 (DEFECT-17-C) — runRoundTable history-load + agent-failure tests.
 *
 * Three behaviors verified against `runRoundTable`:
 *   1. With prior events in the EventStore, every agent's prompt contains a
 *      `--- PRIOR CONVERSATION ---` block listing prior turns by speaker.
 *   2. With zero prior events, the prompt has NO PRIOR CONVERSATION block —
 *      preserves the pre-17.1-07 shape for new runs.
 *   3. When sendToAgent throws for an agent, runRoundTable publishes an
 *      `agent_message` event with `metadata.errorKind === 'agent_failure'`
 *      AND continues to the next agent (failure surfacing per the plan's
 *      transcript-marker design).
 *
 * Pattern follows routes.test.ts: mock `sendToAgent` and `@beagle-console/db`
 * so the unit under test is observable without a real CLI bridge or DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../connections/openclaw-cli-bridge', () => ({
  sendToAgent: vi.fn(async () => null),
}));

// Phase 19: runRoundTable now calls db.select(...).from().where().limit() at
// the top of the function (loadRunConfig). For these single-pass legacy
// tests we mock the chain to return roundCount=1 so the assertions about
// "called 3 times" (one round) still hold. Multi-round behavior has its
// own dedicated tests in routes-multi-round.test.ts.
vi.mock('@beagle-console/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            { roundCount: 1, idleTimeoutMinutes: 7, interRoundPauseMs: 0 },
          ]),
        })),
      })),
    })),
  },
  createTenantSchema: vi.fn(() => ({ runs: {} })),
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
  const persistAndPublish = vi.fn(async (tenantId: string, evt: any) => {
    recorded.push({ tenantId, ...evt });
    return {
      ...evt,
      tenantId,
      sequenceNumber: 99,
      timestamp: '2026-04-29T00:00:00.000Z',
    };
  });
  return { persistAndPublish, recorded };
}

/** Build a fake HubEventEnvelope for an agent_message event. */
function buildPriorEvent(seq: number, agentId: string, text: string) {
  return {
    type: 'agent_message',
    agentId,
    runId: RUN_ID,
    tenantId: TENANT_ID,
    sequenceNumber: seq,
    content: { text },
    metadata: {},
    timestamp: '2026-04-29T00:00:00.000Z',
  };
}

describe('runRoundTable — Phase 17.1-07 history load + agent-failure surfacing', () => {
  beforeEach(() => {
    mockedSendToAgent.mockClear();
    mockedSendToAgent.mockResolvedValue(null);
  });

  it('with 3 prior events, every agent prompt contains the PRIOR CONVERSATION block listing each prior turn', async () => {
    const router = buildRouterMock();
    // EventStore.list returns 3 prior events from a previous round (seq 1,2,3),
    // plus the just-persisted user event for THIS round (seq 4) which must be
    // EXCLUDED from PRIOR CONVERSATION (it's already represented by
    // `User: ${userPrompt}` in the new prompt).
    const priorEvents = [
      buildPriorEvent(1, 'user', 'What is the cap rate?'),
      buildPriorEvent(2, 'mo', 'It depends on the property type.'),
      buildPriorEvent(3, 'jarvis', 'For multifamily, expect 4-6%.'),
      buildPriorEvent(4, 'user', 'Follow-up: what about office?'), // current turn — excluded
    ];
    const eventStore = { list: vi.fn(async () => priorEvents) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'Follow-up: what about office?',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      4, // currentUserSequence — exclude this from the block
    );

    // sendToAgent was called for every configured agent (mo, jarvis, herman)
    expect(mockedSendToAgent).toHaveBeenCalled();
    expect(mockedSendToAgent.mock.calls.length).toBe(3);

    // Every agent's prompt has the PRIOR CONVERSATION header + footer
    for (const call of mockedSendToAgent.mock.calls) {
      const promptArg = (call[1] ?? '') as string;
      expect(promptArg).toContain('--- PRIOR CONVERSATION ---');
      expect(promptArg).toContain('--- END PRIOR CONVERSATION ---');
      // All three prior speakers' lines are present
      expect(promptArg).toContain('User: What is the cap rate?');
      expect(promptArg).toContain('Mo: It depends on the property type.');
      expect(promptArg).toContain('Jarvis: For multifamily, expect 4-6%.');
      // The current-round user message is excluded from PRIOR CONVERSATION
      // block, but DOES appear later as the `User: ${userPrompt}` line.
      const blockMatch = promptArg.match(/--- PRIOR CONVERSATION ---([\s\S]*?)--- END PRIOR CONVERSATION ---/);
      expect(blockMatch).not.toBeNull();
      const blockContent = blockMatch![1] ?? '';
      // The follow-up text must NOT appear inside the block (only outside it).
      expect(blockContent).not.toContain('Follow-up: what about office?');
      // But the prompt as a whole DOES contain it (as the new User: line).
      expect(promptArg).toContain('Follow-up: what about office?');
    }
  });

  it('with 0 prior events, no PRIOR CONVERSATION block appears (new run case)', async () => {
    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'First message in a new run',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    expect(mockedSendToAgent).toHaveBeenCalled();
    for (const call of mockedSendToAgent.mock.calls) {
      const promptArg = (call[1] ?? '') as string;
      // No PRIOR CONVERSATION block in any agent's prompt
      expect(promptArg).not.toContain('PRIOR CONVERSATION');
      expect(promptArg).not.toContain('END PRIOR CONVERSATION');
      // But the new user prompt IS in there
      expect(promptArg).toContain('First message in a new run');
    }
  });

  it('when sendToAgent throws for the first agent, an agent_failure marker event is published and the loop continues', async () => {
    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    // mo throws; jarvis + herman succeed (so only mo produces a failure
    // marker — the rest produce real agent_message events).
    mockedSendToAgent
      .mockRejectedValueOnce(new Error('SSH timeout'))
      .mockResolvedValueOnce({
        text: 'Jarvis ok',
        runId: RUN_ID,
        durationMs: 100,
        costUsd: 0,
        model: 'test',
      })
      .mockResolvedValueOnce({
        text: 'Herman ok',
        runId: RUN_ID,
        durationMs: 100,
        costUsd: 0,
        model: 'test',
      });

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'A new question',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    // sendToAgent was attempted for all 3 agents — the throw on agent 1
    // didn't abort the loop.
    expect(mockedSendToAgent).toHaveBeenCalledTimes(3);

    // Exactly one agent_failure marker event was published — for mo only.
    const failureEvents = router.recorded.filter(
      (e) => (e.metadata as any)?.errorKind === 'agent_failure',
    );
    expect(failureEvents).toHaveLength(1);
    const failure = failureEvents[0]!;
    expect(failure.type).toBe('agent_message');
    expect(failure.agentId).toBe('mo');
    expect(failure.runId).toBe(RUN_ID);
    expect((failure.content as any).text).toContain('failed to respond');
    expect((failure.content as any).text).toContain('Mo'); // displayName, not agentId
    expect((failure.metadata as any).errorMessage).toBe('SSH timeout');
  });

  it('when sendToAgent returns null for an agent, an agent_failure marker event is published (Phase 17.1-08 gap-fix)', async () => {
    // sendToAgent returns null on CLI bridge errors (non-zero exit, parse
    // failure, non-ok status). Before 17.1-08 this produced silent dropouts
    // — only the throw path emitted a failure-bubble. Now both paths do.
    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    // mo returns null (CLI bridge non-zero exit); jarvis + herman succeed.
    mockedSendToAgent
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        text: 'Jarvis ok',
        runId: RUN_ID,
        durationMs: 100,
        costUsd: 0,
        model: 'test',
      })
      .mockResolvedValueOnce({
        text: 'Herman ok',
        runId: RUN_ID,
        durationMs: 100,
        costUsd: 0,
        model: 'test',
      });

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      'A question whose first agent fails silently',
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    expect(mockedSendToAgent).toHaveBeenCalledTimes(3);

    const failureEvents = router.recorded.filter(
      (e) => (e.metadata as any)?.errorKind === 'agent_failure',
    );
    expect(failureEvents).toHaveLength(1);
    const failure = failureEvents[0]!;
    expect(failure.agentId).toBe('mo');
    expect((failure.content as any).text).toContain('failed to respond');
    // The errorMessage distinguishes the failure mode (cli-bridge-null vs throw).
    expect((failure.metadata as any).errorMessage).toBe('cli-bridge-null');
  });

  it('when eventStore.list throws, the round-table proceeds with empty history (graceful degradation per T-17-1-07-04)', async () => {
    const router = buildRouterMock();
    const eventStore = {
      list: vi.fn(async () => {
        throw new Error('DB connection lost');
      }),
    } as any;

    // Should NOT throw — runRoundTable wraps the history fetch in try/catch.
    await expect(
      runRoundTable(
        RUN_ID,
        TENANT_ID,
        'Question that should still get an answer',
        { persistAndPublish: router.persistAndPublish } as any,
        eventStore,
        1,
      ),
    ).resolves.toBeUndefined();

    // sendToAgent was called (agents still got a chance to respond)
    expect(mockedSendToAgent).toHaveBeenCalled();
    // No PRIOR CONVERSATION block in any prompt — empty history fallback
    for (const call of mockedSendToAgent.mock.calls) {
      const promptArg = (call[1] ?? '') as string;
      expect(promptArg).not.toContain('PRIOR CONVERSATION');
    }
  });
});
