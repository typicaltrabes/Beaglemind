/**
 * Phase 19-04 (UX-19-03) — handleRunStart + runRoundTable continueOnly flag.
 *
 * The Continue conversation button on the run-detail page posts to
 * /api/runs/[id]/continue, which calls hub /runs/start with
 * `continueOnly: true`. Two behavior changes flow from that flag:
 *
 *   1. handleRunStart MUST NOT persist a fresh `agent_message` with
 *      `agentId: 'user'` — Continue means "keep cycling, no new user
 *      input."
 *   2. runRoundTable's round-1 first-agent prompt MUST suppress the
 *      `User: ${userPrompt}` line and instead nudge the agent to
 *      "please continue the discussion above" against the prior history
 *      block.
 *
 * Plus a baseline test that continueOnly=false (the default) keeps the
 * pre-19-04 behavior intact.
 *
 * Pattern follows routes.test.ts: mock sendToAgent + @beagle-console/db
 * so the unit under test is observable without a real CLI bridge or DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../connections/openclaw-cli-bridge', () => ({
  sendToAgent: vi.fn(async () => null),
}));

vi.mock('../connections/anthropic-vision-bridge', () => ({
  sendToAgentWithVision: vi.fn(async () => null),
}));

// Configurable db mock — single-round runs by default to keep these tests
// fast and focused on the continueOnly branches (multi-round behavior is
// covered by routes-multi-round.test.ts).
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
  createTenantSchema: vi.fn(() => ({ runs: { id: 'id' } })),
}));

import { handleRunStart, runRoundTable } from '../http/routes';
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

describe('handleRunStart — continueOnly flag (Plan 19-04)', () => {
  beforeEach(() => {
    mockedSendToAgent.mockReset();
    mockedSendToAgent.mockResolvedValue(null);
  });

  it('continueOnly=true skips user-event persist', async () => {
    const router = buildRouterMock();
    const setActiveRun = vi.fn();
    const eventStore = { list: vi.fn(async () => []) } as any;

    const result = await handleRunStart(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        prompt: '',
        continueOnly: true,
      },
      {} as any,
      { persistAndPublish: router.persistAndPublish } as any,
      setActiveRun,
      eventStore,
    );

    // Allow the fire-and-forget runRoundTable to dispatch.
    await new Promise((resolve) => setImmediate(resolve));

    // Critical: NO `agent_message` event with `agentId: 'user'` was
    // persisted. The transcript stays as-is.
    const userEvents = router.recorded.filter(
      (e) => e.type === 'agent_message' && e.agentId === 'user',
    );
    expect(userEvents).toHaveLength(0);

    // Response shape: userSequence is null when continueOnly=true.
    expect(result.ok).toBe(true);
    expect(result.runId).toBe(RUN_ID);
    expect(result.userSequence).toBeNull();
  });

  it('continueOnly=false (default) preserves existing user-event persist behavior', async () => {
    const router = buildRouterMock();
    const setActiveRun = vi.fn();
    const eventStore = { list: vi.fn(async () => []) } as any;

    const userText = 'baseline prompt';
    const result = await handleRunStart(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        prompt: userText,
      },
      {} as any,
      { persistAndPublish: router.persistAndPublish } as any,
      setActiveRun,
      eventStore,
    );

    await new Promise((resolve) => setImmediate(resolve));

    const userEvents = router.recorded.filter(
      (e) => e.type === 'agent_message' && e.agentId === 'user',
    );
    expect(userEvents).toHaveLength(1);
    expect(userEvents[0]!.content).toEqual({ text: userText });

    expect(result.userSequence).toBe(1);
  });
});

describe('runRoundTable — continueOnly flag (Plan 19-04)', () => {
  beforeEach(() => {
    mockedSendToAgent.mockReset();
    mockedSendToAgent.mockResolvedValue(null);
  });

  it('continueOnly=true omits "User:" line in round-1 first-agent prompt', async () => {
    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      '', // empty userPrompt — Continue case
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      -1,
      undefined, // imageAttachments
      true, // continueOnly
    );

    expect(mockedSendToAgent).toHaveBeenCalled();
    const firstAgentPrompt = (mockedSendToAgent.mock.calls[0]?.[1] ?? '') as string;

    // No "User:" line — agents see only prior history + a continue nudge.
    expect(firstAgentPrompt).not.toMatch(/^User:/m);
    expect(firstAgentPrompt).toContain('please continue the discussion');
    // Should still capitalize the agent's display name in the nudge.
    expect(firstAgentPrompt).toContain('Mo, please continue the discussion');
  });

  it('continueOnly=false (default) preserves "User:" line in round-1 first-agent prompt', async () => {
    const router = buildRouterMock();
    const eventStore = { list: vi.fn(async () => []) } as any;

    const userText = 'normal user prompt';

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      userText,
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      1,
    );

    expect(mockedSendToAgent).toHaveBeenCalled();
    const firstAgentPrompt = (mockedSendToAgent.mock.calls[0]?.[1] ?? '') as string;
    expect(firstAgentPrompt).toContain(`User: ${userText}`);
    expect(firstAgentPrompt).toContain("you're first to respond");
    expect(firstAgentPrompt).not.toContain('please continue the discussion');
  });

  it('continueOnly=true with prior history feeds full history to first agent', async () => {
    const router = buildRouterMock();
    // Stub eventStore.list to return 5 prior agent_message events.
    const priorEvents = [
      {
        type: 'agent_message',
        agentId: 'user',
        runId: RUN_ID,
        tenantId: TENANT_ID,
        content: { text: 'original user question' },
        metadata: {},
        sequenceNumber: 1,
        timestamp: '2026-04-30T00:00:00.000Z',
      },
      {
        type: 'agent_message',
        agentId: 'mo',
        runId: RUN_ID,
        tenantId: TENANT_ID,
        content: { text: 'mo round-1 reply' },
        metadata: {},
        sequenceNumber: 2,
        timestamp: '2026-04-30T00:00:01.000Z',
      },
      {
        type: 'agent_message',
        agentId: 'jarvis',
        runId: RUN_ID,
        tenantId: TENANT_ID,
        content: { text: 'jarvis round-1 reply' },
        metadata: {},
        sequenceNumber: 3,
        timestamp: '2026-04-30T00:00:02.000Z',
      },
      {
        type: 'agent_message',
        agentId: 'herman',
        runId: RUN_ID,
        tenantId: TENANT_ID,
        content: { text: 'herman round-1 reply' },
        metadata: {},
        sequenceNumber: 4,
        timestamp: '2026-04-30T00:00:03.000Z',
      },
      {
        type: 'agent_message',
        agentId: 'mo',
        runId: RUN_ID,
        tenantId: TENANT_ID,
        content: { text: 'mo round-2 reply' },
        metadata: {},
        sequenceNumber: 5,
        timestamp: '2026-04-30T00:00:04.000Z',
      },
    ];
    const eventStore = { list: vi.fn(async () => priorEvents) } as any;

    await runRoundTable(
      RUN_ID,
      TENANT_ID,
      '', // empty userPrompt
      { persistAndPublish: router.persistAndPublish } as any,
      eventStore,
      -1, // sentinel — filter is a no-op, full history is fed
      undefined,
      true, // continueOnly
    );

    expect(mockedSendToAgent).toHaveBeenCalled();
    const firstAgentPrompt = (mockedSendToAgent.mock.calls[0]?.[1] ?? '') as string;

    // PRIOR CONVERSATION block exists and contains every event (the
    // sentinel sequenceNumber=-1 makes the filter exclude nothing).
    expect(firstAgentPrompt).toContain('--- PRIOR CONVERSATION ---');
    expect(firstAgentPrompt).toContain('User: original user question');
    expect(firstAgentPrompt).toContain('Mo: mo round-1 reply');
    expect(firstAgentPrompt).toContain('Jarvis: jarvis round-1 reply');
    expect(firstAgentPrompt).toContain('Herman: herman round-1 reply');
    expect(firstAgentPrompt).toContain('Mo: mo round-2 reply');
    expect(firstAgentPrompt).toContain('please continue the discussion');
  });
});
