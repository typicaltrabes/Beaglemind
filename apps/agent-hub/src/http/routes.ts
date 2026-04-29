import { z } from 'zod/v4';
import { randomUUID } from 'node:crypto';
import type { AgentRegistry } from '../connections/agent-registry';
import type { MessageRouter } from '../handlers/message-router';
import type { OpenClawOutbound } from '@beagle-console/shared';
import { createChildLogger } from '../logger';
import { sendToAgent, type OpenClawBridgeConfig } from '../connections/openclaw-cli-bridge';
import { db, createTenantSchema } from '@beagle-console/db';
import { eq } from 'drizzle-orm';

// Agent SSH bridge config — which host to SSH into and optional sudo user
const AGENT_BRIDGE_CONFIG: Record<string, { sshHost: string; sudoUser?: string }> = {
  jarvis: { sshHost: 'root@142.93.76.133' },
  mo: { sshHost: 'lucas@46.225.56.122', sudoUser: 'mo' },
  sam: { sshHost: 'lucas@46.225.56.122', sudoUser: 'sam' },
  herman: { sshHost: 'lucas@46.225.56.122', sudoUser: 'herman' },
};

const log = createChildLogger({ component: 'http-routes' });

// T-03-07: Zod validation on all POST request bodies
const SendBody = z.object({
  agentId: z.string(),
  content: z.string(),
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

const RunStartBody = z.object({
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
  prompt: z.string(),
  // Phase 17.1-06 (DEFECT-17-B): split user-visible content from agent-visible
  // input. When `agentPrompt` is provided, the hub uses it for the OpenClaw
  // round-table input but persists the user event with `prompt` (the user-
  // visible string — no attachment block, no extracted text dump). When
  // omitted, the hub falls back to `prompt` for both, preserving backward
  // compatibility for any caller that still uses the pre-17.1-06 contract.
  agentPrompt: z.string().optional(),
  // Phase 17.1-06: artifact UUIDs uploaded with this user message. When
  // present, the persisted user event carries `content.attachmentIds` so the
  // transcript renders chips (ArtifactCard for documents, inline thumbnail for
  // images) instead of dumping extracted text into the bubble. Validated as
  // UUIDs upstream by the web messages route; capped at 4 to bound prompt
  // size. Omitted → existing { text } content shape, no chips, no regression.
  attachmentIds: z.array(z.string().uuid()).max(4).optional(),
  targetAgent: z.string().default('jarvis'),
});

const RunStopBody = z.object({
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

// T-04-03: Zod validation on approve body
const RunApproveBody = z.object({
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

// T-04-04: Zod validation on question answer body
const QuestionAnswerBody = z.object({
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
  questionId: z.string().uuid(),
  answer: z.string(),
  agentId: z.string(), // which agent asked the question
});

/**
 * POST /send -- relay a user message to the correct agent via WebSocket.
 * Also persists a user event through the pipeline.
 */
export async function handleSend(
  body: unknown,
  registry: AgentRegistry,
  router: MessageRouter,
): Promise<{ ok: true }> {
  const parsed = SendBody.parse(body);

  // Construct OpenClaw outbound message
  const outbound: OpenClawOutbound = {
    type: 'chat.send',
    content: parsed.content,
    messageId: `msg_${randomUUID()}`,
    senderId: `console_${parsed.tenantId}`,
    senderName: 'Console Hub',
    chatType: 'direct',
    customData: {
      runId: parsed.runId,
      tenantId: parsed.tenantId,
    },
  };

  // Note: user message event is persisted by the web app (once), not here (avoids duplicates when called per-agent)

  // Send to agent via CLI bridge (reliable), fall back to WebSocket
  const agentBridge = AGENT_BRIDGE_CONFIG[parsed.agentId];
  if (agentBridge) {
    const bridgeCfg: OpenClawBridgeConfig = {
      agentId: parsed.agentId,
      sshHost: agentBridge.sshHost,
      runId: parsed.runId,
      sudoUser: agentBridge.sudoUser,
    };
    sendToAgent(bridgeCfg, parsed.content).then(async (result) => {
      if (result) {
        await router.persistAndPublish(parsed.tenantId, {
          type: 'agent_message',
          agentId: parsed.agentId,
          runId: parsed.runId,
          tenantId: parsed.tenantId,
          content: { text: result.text },
          metadata: { durationMs: result.durationMs },
        });
      }
    }).catch((err) => {
      log.error({ error: err.message, agentId: parsed.agentId }, 'CLI bridge send failed');
    });
  } else {
    registry.send(parsed.agentId, outbound);
  }

  log.info({ agentId: parsed.agentId, runId: parsed.runId }, 'User message sent');
  return { ok: true };
}

/**
 * POST /runs/start -- initiate a multi-agent round-table discussion.
 * Agents respond sequentially, each seeing the full transcript so far.
 * Mo → Jarvis → Herman (Sam excluded from visible, sentinel only).
 */
export async function handleRunStart(
  body: unknown,
  registry: AgentRegistry,
  router: MessageRouter,
  setActiveRun: (runId: string, tenantId: string) => void,
): Promise<{ ok: true; runId: string; userSequence: number }> {
  const parsed = RunStartBody.parse(body);

  // Set active run context on the Hub
  setActiveRun(parsed.runId, parsed.tenantId);

  // Persist the user prompt through the Hub's EventStore so the SequenceCounter
  // allocates a seq that won't collide with subsequent agent events. Awaited so
  // the event is visible in SSE replay before we return to the caller.
  //
  // Phase 17.1-06 (DEFECT-17-B): the persisted event content carries the user-
  // visible text only (`parsed.prompt`) plus optional `attachmentIds` so the
  // transcript can render chips. The agent-visible string (with attachment
  // block + extracted text) flows separately into runRoundTable below.
  const userEvent = await router.persistAndPublish(parsed.tenantId, {
    type: 'agent_message',
    agentId: 'user',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: parsed.attachmentIds?.length
      ? { text: parsed.prompt, attachmentIds: parsed.attachmentIds }
      : { text: parsed.prompt },
    metadata: {},
  });

  // Run the round-table discussion in the background (don't block the HTTP response).
  // Prefer `agentPrompt` (web-side prepended attachment block) when provided;
  // fall back to `prompt` for backward compatibility with pre-17.1-06 callers.
  const roundTableInput = parsed.agentPrompt ?? parsed.prompt;
  runRoundTable(parsed.runId, parsed.tenantId, roundTableInput, router).catch((err) => {
    log.error({ error: err.message, runId: parsed.runId }, 'Round-table discussion failed');
  });

  log.info({ runId: parsed.runId, userSequence: userEvent.sequenceNumber }, 'Round-table discussion started');
  return { ok: true, runId: parsed.runId, userSequence: userEvent.sequenceNumber };
}

/**
 * Sequential round-table: each agent sees the full conversation so far.
 * Mo responds first, then Jarvis (seeing Mo's response), then Herman (seeing both).
 */
async function runRoundTable(
  runId: string,
  tenantId: string,
  userPrompt: string,
  router: MessageRouter,
) {
  const agents = ['mo', 'jarvis', 'herman']; // Sam excluded — sentinel only
  const transcript: string[] = [];

  for (const agentId of agents) {
    const agentBridge = AGENT_BRIDGE_CONFIG[agentId];
    if (!agentBridge) continue;

    const bridgeCfg: OpenClawBridgeConfig = {
      agentId,
      sshHost: agentBridge.sshHost,
      runId,
      sudoUser: agentBridge.sudoUser,
    };

    // Build the prompt with explicit group discussion context
    const displayName = agentId.charAt(0).toUpperCase() + agentId.slice(1);
    let fullPrompt: string;

    const groupContext = `[SYSTEM] You are on the Beagle Agent Console — a multi-agent discussion platform. This is NOT WhatsApp. This is NOT a 1:1 chat. You are in a GROUP DISCUSSION with other BeagleMind agents (Mo, Jarvis, Herman). The user can see everything all agents say. Respond directly to the topic — do not explain the platform architecture or how messaging works. Just answer the question and engage with what other agents said.`;

    if (transcript.length === 0) {
      // First agent — gets the user prompt with group context
      fullPrompt = `${groupContext}\n\nUser: ${userPrompt}\n\n${displayName}, you're first to respond.`;
    } else {
      // Subsequent agents — see the full discussion so far
      fullPrompt = `${groupContext}\n\n--- GROUP DISCUSSION ---\n\nUser: ${userPrompt}\n\n${transcript.join('\n\n')}\n\n--- YOUR TURN ---\n\n${displayName}, respond to the discussion above. Reference other agents by name when you agree or disagree.`;
    }

    log.info({ runId, agentId, transcriptLength: fullPrompt.length }, 'Sending to agent with full transcript');

    try {
      const result = await sendToAgent(bridgeCfg, fullPrompt);
      if (result && result.text) {
        // Publish agent response as an event (appears in UI immediately)
        await router.persistAndPublish(tenantId, {
          type: 'agent_message',
          agentId,
          runId,
          tenantId,
          content: { text: result.text },
          metadata: { durationMs: result.durationMs, costUsd: result.costUsd, model: result.model },
        });

        // Add to transcript so next agent sees it
        transcript.push(`${displayName}: ${result.text}`);

        log.info({ runId, agentId, responseLength: result.text.length }, 'Agent responded in round-table');
      }
    } catch (err: any) {
      log.error({ error: err.message, runId, agentId }, 'Agent failed in round-table, continuing');
    }
  }

  // UAT-14-02: mark the run completed in the DB so Run History stops showing
  // the amber `executing` chip indefinitely. Best-effort — if the write fails
  // the agent responses are already persisted, so the run is logically done.
  try {
    const { runs: runsTable } = createTenantSchema(tenantId);
    await db
      .update(runsTable)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(runsTable.id, runId));
  } catch (err: any) {
    log.error(
      { error: err.message, runId, tenantId },
      'Failed to mark run completed (continuing)',
    );
  }

  // UAT-14-02: emit state_transition so live UIs flip the chip without a reload.
  // Independent try/catch from the DB write — the DB row is the source of truth;
  // a failed publish must not roll back the status update.
  try {
    await router.persistAndPublish(tenantId, {
      type: 'state_transition',
      agentId: 'system',
      runId,
      tenantId,
      content: { from: 'executing', to: 'completed' },
      metadata: {},
    });
  } catch (err: any) {
    log.error(
      { error: err.message, runId, tenantId },
      'Failed to publish completed state_transition (continuing)',
    );
  }

  log.info({ runId, agentCount: agents.length }, 'Round-table discussion complete');
}

/**
 * POST /runs/stop -- publish a state_transition cancelled event.
 * Does NOT send stop signal to agent (future concern).
 */
export async function handleRunStop(
  body: unknown,
  router: MessageRouter,
  clearActiveRun: () => void,
): Promise<{ ok: true }> {
  const parsed = RunStopBody.parse(body);

  // Persist state_transition event
  await router.persistAndPublish(parsed.tenantId, {
    type: 'state_transition',
    agentId: 'system',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: { from: 'executing', to: 'cancelled' },
    metadata: {},
  });

  // Clear active run context
  clearActiveRun();

  log.info({ runId: parsed.runId }, 'Run stopped');
  return { ok: true };
}

/**
 * POST /runs/approve -- send approval signal to Mo and publish state transitions.
 * Transitions: planned -> approved -> executing (D-09).
 */
export async function handleRunApprove(
  body: unknown,
  registry: AgentRegistry,
  router: MessageRouter,
): Promise<{ ok: true }> {
  const parsed = RunApproveBody.parse(body);

  // Send approval signal to Mo
  const outbound: OpenClawOutbound = {
    type: 'chat.send',
    content: '[SYSTEM] Plan approved. Proceed with execution.',
    messageId: `msg_${randomUUID()}`,
    senderId: `console_${parsed.tenantId}`,
    senderName: 'Console Hub',
    chatType: 'direct',
    customData: { runId: parsed.runId, tenantId: parsed.tenantId },
  };
  registry.send('mo', outbound);

  // Persist planned -> approved transition (triggered by user)
  await router.persistAndPublish(parsed.tenantId, {
    type: 'state_transition',
    agentId: 'system',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: { from: 'planned', to: 'approved', triggeredBy: 'user' },
    metadata: {},
  });

  // Immediately transition approved -> executing (triggered by system)
  await router.persistAndPublish(parsed.tenantId, {
    type: 'state_transition',
    agentId: 'system',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: { from: 'approved', to: 'executing', triggeredBy: 'system' },
    metadata: {},
  });

  log.info({ runId: parsed.runId }, 'Run approved');
  return { ok: true };
}

/**
 * POST /runs/questions/answer -- forward a user's answer to the asking agent (D-15).
 * Also persists the answer as a user event.
 */
export async function handleQuestionAnswer(
  body: unknown,
  registry: AgentRegistry,
  router: MessageRouter,
): Promise<{ ok: true }> {
  const parsed = QuestionAnswerBody.parse(body);

  // Forward answer to the asking agent
  const outbound: OpenClawOutbound = {
    type: 'chat.send',
    content: `[ANSWER to Q-${parsed.questionId}] ${parsed.answer}`,
    messageId: `msg_${randomUUID()}`,
    senderId: `console_${parsed.tenantId}`,
    senderName: 'Console Hub',
    chatType: 'direct',
    customData: { runId: parsed.runId, tenantId: parsed.tenantId, questionId: parsed.questionId },
  };
  registry.send(parsed.agentId, outbound);

  // Persist user answer as an event
  await router.persistAndPublish(parsed.tenantId, {
    type: 'agent_message',
    agentId: 'user',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: { text: parsed.answer, questionId: parsed.questionId, isAnswer: true },
    metadata: { targetAgent: parsed.agentId },
  });

  log.info({ runId: parsed.runId, questionId: parsed.questionId, agentId: parsed.agentId }, 'Question answered');
  return { ok: true };
}
