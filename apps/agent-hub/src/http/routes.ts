import { z } from 'zod/v4';
import { randomUUID } from 'node:crypto';
import type { AgentRegistry } from '../connections/agent-registry';
import type { MessageRouter } from '../handlers/message-router';
import type { OpenClawOutbound } from '@beagle-console/shared';
import { createChildLogger } from '../logger';

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
  targetAgent: z.string().default('mo'),
});

const RunStopBody = z.object({
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
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

  // Send to agent via WebSocket
  registry.send(parsed.agentId, outbound);

  // Persist user message as an event
  await router.persistAndPublish(parsed.tenantId, {
    type: 'agent_message',
    agentId: 'user',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: { text: parsed.content },
    metadata: { targetAgent: parsed.agentId },
  });

  log.info({ agentId: parsed.agentId, runId: parsed.runId }, 'User message sent');
  return { ok: true };
}

/**
 * POST /runs/start -- initiate a run and send the prompt to the target agent.
 * Defaults targetAgent to 'mo'.
 */
export async function handleRunStart(
  body: unknown,
  registry: AgentRegistry,
  router: MessageRouter,
  setActiveRun: (runId: string, tenantId: string) => void,
): Promise<{ ok: true; runId: string }> {
  const parsed = RunStartBody.parse(body);

  // Set active run context on the Hub
  setActiveRun(parsed.runId, parsed.tenantId);

  // Construct OpenClaw outbound message with the prompt
  const outbound: OpenClawOutbound = {
    type: 'chat.send',
    content: parsed.prompt,
    messageId: `msg_${randomUUID()}`,
    senderId: `console_${parsed.tenantId}`,
    senderName: 'Console Hub',
    chatType: 'direct',
    customData: {
      runId: parsed.runId,
      tenantId: parsed.tenantId,
    },
  };

  // Send prompt to target agent
  registry.send(parsed.targetAgent, outbound);

  // Persist state_transition event
  await router.persistAndPublish(parsed.tenantId, {
    type: 'state_transition',
    agentId: 'system',
    runId: parsed.runId,
    tenantId: parsed.tenantId,
    content: { from: 'pending', to: 'executing' },
    metadata: { targetAgent: parsed.targetAgent },
  });

  log.info({ runId: parsed.runId, targetAgent: parsed.targetAgent }, 'Run started');
  return { ok: true, runId: parsed.runId };
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
