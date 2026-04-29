/**
 * Phase 17.1-06 (DEFECT-17-B) — handleRunStart prompt-vs-agentPrompt split.
 *
 * The hub's RunStartBody now accepts an optional `agentPrompt` field. When
 * provided, the user event is persisted with the user-visible `prompt`
 * (no attachment block, no extracted-text dump) while the OpenClaw round-table
 * receives `agentPrompt`. When omitted, both default to `prompt` — backward
 * compatible with all pre-17.1-06 callers.
 *
 * These tests exercise that contract by mocking `sendToAgent` (named export
 * from openclaw-cli-bridge — the one place runRoundTable funnels its prompt
 * string out to the world) and `router.persistAndPublish` (where the user
 * event is written). We do NOT spin up real CLI bridges or DB connections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the CLI bridge so runRoundTable's per-agent sendToAgent calls become
// observable assertion targets. Returning null short-circuits the inner
// `if (result && result.text)` so we don't try to persist an agent response.
vi.mock('../connections/openclaw-cli-bridge', () => ({
  sendToAgent: vi.fn(async () => null),
}));

// Mock the @beagle-console/db package — runRoundTable's tail calls
// db.update(...).set(...).where(...) to mark the run completed. We don't need
// that to actually fire, just to not throw.
vi.mock('@beagle-console/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  },
  createTenantSchema: vi.fn(() => ({ runs: {} })),
}));

import { handleRunStart } from '../http/routes';
import { sendToAgent } from '../connections/openclaw-cli-bridge';

const mockedSendToAgent = vi.mocked(sendToAgent);

// Real RFC 4122 v4 UUIDs — Zod v4 .uuid() is strict on version + variant
// nibbles; placeholder values like '00000000-0000-0000-0000-000000000001'
// fail the regex (see Phase 17.1-05 SUMMARY for the same pitfall).
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
      sequenceNumber: 1,
      timestamp: '2026-04-29T00:00:00.000Z',
    };
  });
  return { persistAndPublish, recorded };
}

describe('handleRunStart — Phase 17.1-06 agentPrompt split', () => {
  beforeEach(() => {
    mockedSendToAgent.mockClear();
    mockedSendToAgent.mockResolvedValue(null);
  });

  it('agentPrompt OMITTED — runRoundTable receives the same string as the persisted user event (backward-compatible)', async () => {
    const router = buildRouterMock();
    const setActiveRun = vi.fn();
    // Phase 17.1-07: eventStore.list is invoked by runRoundTable before the
    // per-agent loop. Empty list = no PRIOR CONVERSATION block, preserves the
    // pre-17.1-07 prompt shape for these backward-compat assertions.
    const eventStore = { list: vi.fn(async () => []) } as any;

    const userText = 'What is the cap rate on this deal?';

    const result = await handleRunStart(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        prompt: userText,
        targetAgent: 'jarvis',
      },
      // registry — unused by handleRunStart's body
      {} as any,
      // router — only persistAndPublish is touched
      { persistAndPublish: router.persistAndPublish } as any,
      setActiveRun,
      eventStore,
    );

    expect(result).toEqual({ ok: true, runId: RUN_ID, userSequence: 1 });

    // setActiveRun fired with the right tuple
    expect(setActiveRun).toHaveBeenCalledWith(RUN_ID, TENANT_ID);

    // Exactly one user event persisted (the runRoundTable agent calls all
    // short-circuit because sendToAgent returns null in this test)
    const userEvents = router.recorded.filter((e) => e.agentId === 'user');
    expect(userEvents).toHaveLength(1);
    const userEvent = userEvents[0]!;
    expect(userEvent.content).toEqual({ text: userText });
    // No attachmentIds key when none provided — preserves existing event shape
    expect(userEvent.content).not.toHaveProperty('attachmentIds');

    // Wait for the fire-and-forget runRoundTable to dispatch its first
    // sendToAgent call (the function awaits sendToAgent inside the for loop,
    // so a single microtask flush via setImmediate is enough).
    await new Promise((resolve) => setImmediate(resolve));

    // sendToAgent was called with the SAME string the user event was persisted
    // with — no attachment block injected, no divergence between user-visible
    // and agent-visible text.
    expect(mockedSendToAgent).toHaveBeenCalled();
    const firstAgentPromptArg = mockedSendToAgent.mock.calls[0]?.[1] ?? '';
    expect(firstAgentPromptArg).toContain(userText);
  });

  it('agentPrompt PROVIDED — persisted user event keeps `prompt` (clean), runRoundTable receives `agentPrompt` (with attachment block)', async () => {
    const router = buildRouterMock();
    const setActiveRun = vi.fn();
    const eventStore = { list: vi.fn(async () => []) } as any;

    const userText = 'Pull the cap rate out of this deck.';
    const agentText =
      '--- USER ATTACHMENTS ---\n[1] deck.pdf (PDF, 1.2 MB)\nExtracted text: lorem ipsum dolor...\n--- END ATTACHMENTS ---\n\n' +
      userText;
    const attachmentIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];

    await handleRunStart(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        prompt: userText,
        agentPrompt: agentText,
        attachmentIds,
        targetAgent: 'jarvis',
      },
      {} as any,
      { persistAndPublish: router.persistAndPublish } as any,
      setActiveRun,
      eventStore,
    );

    // The persisted user event holds the user-visible text only — NOT the
    // attachment block — and carries attachmentIds for chip rendering.
    const userEvents = router.recorded.filter((e) => e.agentId === 'user');
    expect(userEvents).toHaveLength(1);
    const userEvent = userEvents[0]!;
    expect(userEvent.content).toEqual({
      text: userText,
      attachmentIds,
    });
    // Defensive: the attachment block string MUST NOT appear in the persisted
    // event content. This is the entire point of DEFECT-17-B.
    expect(JSON.stringify(userEvent.content)).not.toContain(
      '--- USER ATTACHMENTS ---',
    );
    expect(JSON.stringify(userEvent.content)).not.toContain(
      'Extracted text:',
    );

    await new Promise((resolve) => setImmediate(resolve));

    // sendToAgent received the FULL agentPrompt (with attachment block), not
    // the clean userText.
    expect(mockedSendToAgent).toHaveBeenCalled();
    const firstAgentPromptArg = mockedSendToAgent.mock.calls[0]?.[1] ?? '';
    expect(firstAgentPromptArg).toContain('--- USER ATTACHMENTS ---');
    expect(firstAgentPromptArg).toContain('Extracted text:');
    expect(firstAgentPromptArg).toContain(userText);
  });
});
