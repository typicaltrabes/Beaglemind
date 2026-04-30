import { z } from 'zod/v4';
import { randomUUID } from 'node:crypto';
import type { AgentRegistry } from '../connections/agent-registry';
import type { MessageRouter } from '../handlers/message-router';
import type { EventStore } from '../events/event-store';
import type { OpenClawOutbound } from '@beagle-console/shared';
import { createChildLogger } from '../logger';
import { sendToAgent, type OpenClawBridgeConfig } from '../connections/openclaw-cli-bridge';
import { sendToAgentWithVision } from '../connections/anthropic-vision-bridge';
import { db, createTenantSchema } from '@beagle-console/db';
import { eq, sql } from 'drizzle-orm';

// Agent SSH bridge config — which host to SSH into and optional sudo user
const AGENT_BRIDGE_CONFIG: Record<string, { sshHost: string; sudoUser?: string }> = {
  jarvis: { sshHost: 'root@142.93.76.133' },
  mo: { sshHost: 'lucas@46.225.56.122', sudoUser: 'mo' },
  sam: { sshHost: 'lucas@46.225.56.122', sudoUser: 'sam' },
  herman: { sshHost: 'lucas@46.225.56.122', sudoUser: 'herman' },
};

// Phase 17.1-03: agents whose underlying model accepts image bytes via the
// OpenClaw CLI bridge. Mirrors the visionCapable flag in
// apps/web/lib/agent-config.ts. Kept hardcoded here (rather than imported
// from web) to avoid a cross-app dependency for one boolean — promote to
// @beagle-console/shared if the list grows or a third consumer appears.
//
// NOTE per openclaw-flag-verification.md (outcome D, 2026-04-29): the
// OpenClaw `agent` CLI does not yet support image input, so the bridge
// log-and-skips bytes regardless of this gate. The gate stays in place
// so when OpenClaw ships a vision flag, only the bridge body needs the
// drop-bytes-vs-forward-bytes flip — Mo/Jarvis are already opted-in.
const VISION_CAPABLE = new Set(['mo', 'jarvis']);

const log = createChildLogger({ component: 'http-routes' });

// T-03-07: Zod validation on all POST request bodies
const SendBody = z.object({
  agentId: z.string(),
  content: z.string(),
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

// Phase 17.1-03: image bytes forwarded from the web app for vision-capable
// agents (Mo, Jarvis). The hub gates by VISION_CAPABLE before passing to the
// CLI bridge — non-vision agents see only the textual description that's
// already baked into the prompt by Plan 17.1-02.
//
// Per PATTERNS Option A: defined inline rather than in
// packages/shared/src/hub-events.ts to avoid cross-package coordination
// for one optional field. Move to shared if a third consumer appears.
const HubImageAttachment = z.object({
  filename: z.string(),
  mimeType: z.string(),
  base64: z.string(),
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
  // Phase 17.1-03: image bytes for vision-capable agents only. Capped at 4
  // (matches per-message attachment cap from Phase 17). Routed through the
  // VISION_CAPABLE gate in runRoundTable; non-vision agents never see the
  // bytes — they get the description floor from the prompt block.
  imageAttachments: z.array(HubImageAttachment).max(4).optional(),
  targetAgent: z.string().default('jarvis'),
  // Phase 19-04 (UX-19-03): when true, the hub re-enters the round-table
  // for another N rounds WITHOUT persisting a new user event and WITHOUT
  // injecting a `User: <prompt>` line into the first agent's prompt.
  // Used by the Continue conversation button on the run-detail page —
  // see apps/web/app/api/runs/[id]/continue/route.ts.
  continueOnly: z.boolean().default(false),
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
  eventStore: EventStore,
): Promise<{ ok: true; runId: string; userSequence: number | null }> {
  const parsed = RunStartBody.parse(body);

  // Set active run context on the Hub
  setActiveRun(parsed.runId, parsed.tenantId);

  // Phase 19-04 (UX-19-03): when continueOnly=true, skip the user-event
  // persist (Continue means "no new user input — keep cycling"). We pass
  // -1 as the sentinel currentUserSequence into runRoundTable so the
  // PRIOR CONVERSATION filter (which excludes `sequenceNumber === currentUserSequence`)
  // becomes a no-op — every prior event flows into the agent's context.
  let userSequence: number | null = null;
  if (!parsed.continueOnly) {
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
    userSequence = userEvent.sequenceNumber;
  } else {
    log.info(
      { runId: parsed.runId },
      'continueOnly=true; skipping user-event persist',
    );
  }

  // Run the round-table discussion in the background (don't block the HTTP response).
  // Prefer `agentPrompt` (web-side prepended attachment block) when provided;
  // fall back to `prompt` for backward compatibility with pre-17.1-06 callers.
  // Phase 17.1-03: forward optional imageAttachments — runRoundTable applies
  // the VISION_CAPABLE gate per-agent before handing bytes to the CLI bridge.
  // Phase 17.1-07 (DEFECT-17-C): runRoundTable also pulls prior conversation
  // history from `eventStore` BEFORE the per-agent loop, so follow-up messages
  // on a `completed` run get a context-aware fan-out. The just-persisted user
  // event's sequenceNumber is excluded from PRIOR CONVERSATION (it's already
  // represented by `User: ${userPrompt}` in the prompt body).
  const roundTableInput = parsed.agentPrompt ?? parsed.prompt;
  runRoundTable(
    parsed.runId,
    parsed.tenantId,
    roundTableInput,
    router,
    eventStore,
    userSequence ?? -1,
    parsed.imageAttachments,
    parsed.continueOnly,
  ).catch((err) => {
    log.error({ error: err.message, runId: parsed.runId }, 'Round-table discussion failed');
  });

  log.info({ runId: parsed.runId, userSequence, continueOnly: parsed.continueOnly }, 'Round-table discussion started');
  return { ok: true, runId: parsed.runId, userSequence };
}

// Phase 17.1-07 (DEFECT-17-C): hard caps for the PRIOR CONVERSATION block.
// 30 events OR 80K chars — whichever hits first. Drop oldest first to keep
// the most-recent context.
const HISTORY_EVENT_LIMIT = 30;
const HISTORY_CHAR_BUDGET = 80_000;

/**
 * Phase 19: read per-run configuration snapshot from the tenant's runs row.
 * Per CONTEXT.md Claude's Discretion: per-run snapshot (not project-scoped),
 * so changing project defaults later does NOT retroactively affect in-flight
 * runs. Falls back to defaults (3, 7, 1500) if the row is missing or the
 * columns are NULL on legacy data — covers the gap between migration apply
 * and the next runs.update that populates them.
 */
/**
 * Phase 19-03 (UX-19-05): emit a per-agent presence indicator event.
 *
 * Called immediately before each bridge call (`phase: 'start'`) and immediately
 * after the bridge call returns or throws (`phase: 'end'`, fired from the
 * try/finally below). Wrapped in its own try/catch so a failed publish never
 * blocks the actual agent invocation — presence is best-effort.
 *
 * Both events flow through MessageRouter.persistAndPublish, which means they:
 *   (a) get a sequenceNumber + timestamp (so SSE replay sees them ordered),
 *   (b) reach SSE consumers via Redis pub/sub, and
 *   (c) reschedule the idle-timeout watcher (Plan 19-02) — typing counts as activity.
 *
 * The run-store on the web side (Plan 19-03 Task 3) drives the inline
 * `Mo is thinking…` indicator off the live `presence_thinking_start` events
 * and clears on either the matching `_end` OR the agent's actual reply.
 */
async function emitPresence(
  router: MessageRouter,
  tenantId: string,
  runId: string,
  agentId: string,
  phase: 'start' | 'end',
): Promise<void> {
  const type =
    phase === 'start' ? 'presence_thinking_start' : 'presence_thinking_end';
  try {
    await router.persistAndPublish(tenantId, {
      type,
      agentId,
      runId,
      tenantId,
      content: { event: type },
      metadata: {},
    });
  } catch (err: any) {
    log.error(
      { error: err.message, runId, agentId, phase },
      'Failed to emit presence event (continuing)',
    );
  }
}

async function loadRunConfig(tenantId: string, runId: string): Promise<{
  roundCount: number;
  idleTimeoutMinutes: number;
  interRoundPauseMs: number;
}> {
  try {
    const { runs: runsTable } = createTenantSchema(tenantId);
    const rows = await db
      .select({
        roundCount: runsTable.roundCount,
        idleTimeoutMinutes: runsTable.idleTimeoutMinutes,
        interRoundPauseMs: runsTable.interRoundPauseMs,
      })
      .from(runsTable)
      .where(eq(runsTable.id, runId))
      .limit(1);
    const row = rows[0];
    return {
      roundCount: row?.roundCount ?? 3,
      idleTimeoutMinutes: row?.idleTimeoutMinutes ?? 7,
      interRoundPauseMs: row?.interRoundPauseMs ?? 1500,
    };
  } catch (err: any) {
    log.error(
      { error: err.message, runId, tenantId },
      'loadRunConfig failed; using defaults',
    );
    return { roundCount: 3, idleTimeoutMinutes: 7, interRoundPauseMs: 1500 };
  }
}

/**
 * Phase 19-05: pull any user messages that were posted during the prior round
 * and marked `metadata.queuedForNextRound = true`. Returns the concatenated
 * text under a single `User:` prefix, or empty string if nothing queued.
 * Atomically clears the flag on consumed rows via jsonb_set so the same
 * messages are not re-injected on subsequent rounds.
 *
 * Tenant isolation: all reads + the UPDATE are scoped by `runId` (which
 * itself lives only inside the tenant schema via createTenantSchema).
 */
async function consumeQueuedMessages(
  eventStore: EventStore,
  tenantId: string,
  runId: string,
): Promise<string> {
  const events = await eventStore.list(tenantId, runId, { limit: 100 });
  const queued = events.filter(
    (e) =>
      e.type === 'agent_message' &&
      e.agentId === 'user' &&
      (e.metadata as Record<string, unknown> | undefined)?.queuedForNextRound === true,
  );
  if (queued.length === 0) return '';

  // Already ASC by sequenceNumber from EventStore.list — concatenate in
  // send-order under a single `User:` prefix.
  const texts = queued
    .map((e) => (e.content as { text?: string }).text ?? '')
    .filter(Boolean);
  if (texts.length === 0) return '';
  const combined = texts.length === 1 ? texts[0] : texts.join('\n\n');

  // Clear the flag on consumed rows. Wrapped in try/catch — if the UPDATE
  // fails (DB blip, schema drift), we log and continue: the worst case is
  // the same messages re-prepend on the next round (UAT will catch it),
  // which is preferable to aborting the whole round-table.
  try {
    const { events: eventsTable } = createTenantSchema(tenantId);
    await db.execute(sql`
      UPDATE ${eventsTable}
      SET metadata = jsonb_set(
        jsonb_set(metadata, '{queuedForNextRound}', 'false'::jsonb),
        '{consumedAt}', to_jsonb(now()::text)
      )
      WHERE run_id = ${runId}
        AND metadata->>'queuedForNextRound' = 'true'
    `);
  } catch (err: any) {
    log.error(
      { error: err.message, runId },
      'Failed to clear queuedForNextRound flag (non-blocking)',
    );
  }

  return `User: ${combined}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sequential round-table: each agent sees the full conversation so far.
 * Mo responds first, then Jarvis (seeing Mo's response), then Herman (seeing both).
 *
 * Phase 17.1-07: prior conversation events for the run are fetched from the
 * EventStore BEFORE the per-agent loop and injected as a `--- PRIOR CONVERSATION ---`
 * block in each agent's prompt — so follow-up messages on a `completed` run
 * land with full context. The just-persisted user event (whose sequenceNumber
 * is `currentUserSequence`) is excluded from the block; it's already present
 * as `User: ${userPrompt}` later in the prompt.
 *
 * Phase 19: wraps the per-agent loop in an outer N-rounds loop (default N=3).
 * Each round: mo -> jarvis -> herman, all seeing the accumulating in-run
 * transcript. Between rounds k and k+1, emits a `state_transition` event with
 * `content.from='round-k', content.to='round-(k+1)'` and sleeps
 * `interRoundPauseMs` (default 1500ms). The vision pass-through fires on
 * round 1 ONLY — rounds 2+ are text-only because the user's image is
 * associated with the initial prompt only (single-image-per-prompt semantics
 * from Phase 17). The unconditional `status: 'completed'` write that lived
 * here pre-Phase-19 is REMOVED — the run stays `executing` indefinitely;
 * Plan 19-02's idle-timeout watcher is the sole writer of `completed`.
 */
export async function runRoundTable(
  runId: string,
  tenantId: string,
  userPrompt: string,
  router: MessageRouter,
  eventStore: EventStore,
  currentUserSequence: number,
  imageAttachments?: Array<{ filename: string; mimeType: string; base64: string }>,
  // Phase 19-04 (UX-19-03): when true, the round-1 first-agent prompt
  // suppresses the `User: ${userPrompt}` line and instead nudges the
  // agent to "please continue the discussion above". Subsequent agents
  // in the same round (transcript.length > 0) also drop the empty
  // `User: ` line from the GROUP DISCUSSION header for cleanliness.
  // Driven by the Continue conversation button — see
  // apps/web/components/transcript/continue-button.tsx.
  continueOnly: boolean = false,
) {
  const agents = ['mo', 'jarvis', 'herman']; // Sam excluded — sentinel only
  const { roundCount, interRoundPauseMs } = await loadRunConfig(tenantId, runId);

  // Phase 17.1-07: fetch prior conversation history. Wrapped in try/catch —
  // if eventStore.list throws (DB blip, schema missing), proceed with empty
  // history (graceful degradation; agents respond context-blind, but they DO
  // respond — better than silent failure per the threat register T-17-1-07-04).
  // Loaded ONCE before the rounds loop because prior-event history doesn't
  // change between rounds; the IN-RUN transcript accumulates separately below.
  let historyBlock = '';
  try {
    const priorEvents = await eventStore.list(tenantId, runId, { limit: HISTORY_EVENT_LIMIT });
    // Only conversation-bearing events go in the block. The just-persisted
    // user event for THIS round is excluded — it's already represented as
    // `User: ${userPrompt}` later in the prompt body. Phase 19-05: also
    // exclude events with metadata.queuedForNextRound=true — those are
    // queued for the NEXT round's consumeQueuedMessages call, so listing
    // them here would either (a) leak future input into round 1 or (b)
    // double-list them once consumeQueuedMessages prepends them. The flag
    // is cleared post-consumption, so consumed-and-cleared events (with
    // metadata.queuedForNextRound=false + consumedAt set) DO show up here
    // as normal user turns from prior rounds.
    const conversationEvents = priorEvents.filter(
      (e) =>
        e.type === 'agent_message' &&
        e.sequenceNumber !== currentUserSequence &&
        (e.metadata as Record<string, unknown> | undefined)?.queuedForNextRound !== true,
    );

    if (conversationEvents.length > 0) {
      const lines = conversationEvents.map((e) => {
        const speaker =
          e.agentId === 'user'
            ? 'User'
            : e.agentId.charAt(0).toUpperCase() + e.agentId.slice(1);
        const text = (e.content as { text?: string }).text ?? '';
        return `${speaker}: ${text}`;
      });
      // Trim oldest entries until under the char budget.
      while (lines.join('\n\n').length > HISTORY_CHAR_BUDGET && lines.length > 0) {
        lines.shift();
      }
      if (lines.length > 0) {
        historyBlock = `--- PRIOR CONVERSATION ---\n\n${lines.join('\n\n')}\n\n--- END PRIOR CONVERSATION ---\n\n`;
      }
    }
    log.info(
      { runId, priorEventCount: priorEvents.length, includedInBlock: historyBlock.length > 0 ? conversationEvents.length : 0 },
      'Prior conversation history loaded',
    );
  } catch (err: any) {
    log.error(
      { error: err.message, runId, tenantId },
      'Failed to load prior conversation history (continuing with empty block)',
    );
    historyBlock = '';
  }

  // Phase 19: accumulating IN-RUN transcript: every reply from every round
  // goes here and feeds the GROUP DISCUSSION block of subsequent agents
  // (within the round AND across rounds).
  const transcript: string[] = [];

  for (let round = 1; round <= roundCount; round++) {
    // Phase 19: bookkeeping for UI + the watcher (Plan 19-02 reads
    // current_round). Best-effort — a failed write must not abort the round.
    try {
      const { runs: runsTable } = createTenantSchema(tenantId);
      await db
        .update(runsTable)
        .set({ currentRound: round, updatedAt: new Date() })
        .where(eq(runsTable.id, runId));
    } catch (err: any) {
      log.error(
        { error: err.message, runId, round },
        'Failed to update current_round (continuing)',
      );
    }

    // Phase 19-05: at the start of round 2+, pull any user messages that were
    // posted DURING the prior round (marked metadata.queuedForNextRound=true)
    // and prepend them as a single `User: ...` block onto the in-run
    // transcript. Round 1 is skipped because the user's initial prompt IS the
    // round-1 input — queued messages by definition target round 2+.
    if (round > 1) {
      const queuedBlock = await consumeQueuedMessages(eventStore, tenantId, runId);
      if (queuedBlock) {
        // Append to transcript so the chronological flow holds: prior round's
        // mo→jarvis→herman replies, THEN the new user input, THEN this
        // round's responses build on top.
        transcript.push(queuedBlock);
        log.info(
          { runId, round, queuedLength: queuedBlock.length },
          'Consumed queued user messages into GROUP DISCUSSION',
        );
      }
    }

    let allFailedThisRound = true;

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
        // Round 1, first agent — gets the user prompt with group context
        // (and prior history, if any, between the system context and the
        // new turn).
        //
        // Phase 19-04 (UX-19-03): under continueOnly the agent sees prior
        // history + a "please continue" nudge — no fresh `User:` line, since
        // the user did not enter new input.
        if (continueOnly) {
          fullPrompt = `${groupContext}\n\n${historyBlock}${displayName}, please continue the discussion above.`;
        } else {
          fullPrompt = `${groupContext}\n\n${historyBlock}User: ${userPrompt}\n\n${displayName}, you're first to respond.`;
        }
      } else {
        // Subsequent agents (within or across rounds) — see prior history
        // (if any), the new user prompt, and the in-progress group discussion
        // accumulating across the run so far.
        //
        // Phase 19-04 (UX-19-03): under continueOnly suppress the empty
        // `User: ` line from the GROUP DISCUSSION header — there's no new
        // user input, the prior history block + accumulating transcript
        // give the agent enough context.
        const userLine = continueOnly ? '' : `User: ${userPrompt}\n\n`;
        fullPrompt = `${groupContext}\n\n${historyBlock}--- GROUP DISCUSSION ---\n\n${userLine}${transcript.join('\n\n')}\n\n--- YOUR TURN ---\n\n${displayName}, respond to the discussion above. Reference other agents by name when you agree or disagree.`;
      }

      log.info(
        { runId, agentId, round, transcriptLength: fullPrompt.length },
        'Sending to agent with full transcript',
      );

      // Vision dispatch (Phase 17.1-09): when the user attached images AND
      // this agent is vision-capable, bypass the text-only OpenClaw CLI
      // bridge and call Anthropic Messages API directly with the image as a
      // content block. SOUL.md is loaded as the system prompt so persona /
      // voice carry through. Falls back to the CLI bridge if the vision path
      // fails so a vision-bridge outage never produces total silence.
      //
      // Phase 19: vision pass-through fires on ROUND 1 ONLY. Rounds 2+ are
      // text-only because the user's image is associated with the initial
      // prompt only (single-image-per-prompt semantics from Phase 17). The
      // round-1 vision turn already produced a textual reply that lives in
      // the GROUP DISCUSSION block, so rounds 2+ inherit context as text.
      const useVision =
        round === 1 &&
        imageAttachments &&
        imageAttachments.length > 0 &&
        VISION_CAPABLE.has(agentId);

      // Phase 19-03 (UX-19-05): wrap the per-agent bridge call with
      // presence_thinking_start (before) + presence_thinking_end (after).
      // try/finally guarantees _end fires even if the bridge throws
      // synchronously. Both emissions are best-effort (emitPresence has its
      // own try/catch) so a Redis hiccup never blocks the agent invocation.
      await emitPresence(router, tenantId, runId, agentId, 'start');
      try {
        let agentFailureReason: string | null = null;
        try {
          let result: Awaited<ReturnType<typeof sendToAgent>> = null;
          if (useVision) {
            result = await sendToAgentWithVision(
              { agentId, runId },
              fullPrompt,
              imageAttachments!,
            );
            if (!result) {
              log.warn(
                { runId, agentId, round },
                'Vision bridge returned null — falling back to text-only CLI bridge',
              );
            }
          }
          if (!result) {
            result = await sendToAgent(bridgeCfg, fullPrompt);
          }
          if (result && result.text) {
            await router.persistAndPublish(tenantId, {
              type: 'agent_message',
              agentId,
              runId,
              tenantId,
              content: { text: result.text },
              metadata: {
                durationMs: result.durationMs,
                costUsd: result.costUsd,
                model: result.model,
                round,
              },
            });

            transcript.push(`${displayName}: ${result.text}`);
            allFailedThisRound = false;

            log.info(
              { runId, agentId, round, responseLength: result.text.length },
              'Agent responded in round-table',
            );
          } else {
            // sendToAgent returns null on CLI bridge errors (non-zero exit,
            // parse failure, non-ok status). Phase 17.1 gap-fix: surface this
            // as a failure-bubble in the transcript so the user isn't met
            // with silence.
            agentFailureReason = result === null ? 'cli-bridge-null' : 'empty-text';
          }
        } catch (err: any) {
          log.error(
            { error: err.message, runId, agentId, round },
            'Agent threw in round-table, continuing',
          );
          agentFailureReason = err.message || 'unknown-throw';
        }

        if (agentFailureReason) {
          // Phase 17.1-07 (DEFECT-17-C): surface the failure in the transcript
          // as a one-line marker so the user sees who failed instead of
          // silence. We emit a normal `agent_message` (NOT a new event type)
          // so SSE replay / chip rendering / scene grouping all keep working
          // unchanged. The `metadata.errorKind: 'agent_failure'` flag lets
          // future UI bits (or the sentinel) distinguish a real reply from a
          // failure marker. Phase 19: the round still counts toward N (per
          // CONTEXT.md decisions: "the round still counts toward N, the loop
          // continues, but log a warning"). No early-stop.
          try {
            await router.persistAndPublish(tenantId, {
              type: 'agent_message',
              agentId,
              runId,
              tenantId,
              content: {
                text: `(${displayName} failed to respond — see logs for details)`,
              },
              metadata: {
                errorKind: 'agent_failure',
                errorMessage: agentFailureReason,
                round,
              },
            });
          } catch (publishErr: any) {
            log.error(
              { error: publishErr.message, runId, agentId, round },
              'Failed to publish agent_failure marker event',
            );
          }
        }
      } finally {
        // Phase 19-03: presence_thinking_end is guaranteed to fire — even if
        // the bridge call throws synchronously above. The web run-store will
        // also clear the indicator early on the matching agent_message, so
        // a stuck indicator requires BOTH the agent to throw AND the _end
        // emission to fail (defense in depth per the threat register).
        await emitPresence(router, tenantId, runId, agentId, 'end');
      }
    }

    if (allFailedThisRound) {
      log.warn(
        { runId, round },
        'All agents failed in round; continuing to next round (no early-stop per CONTEXT.md)',
      );
    }

    // Phase 19: inter-round transition. Emit state_transition + sleep — but
    // only if there's a NEXT round. Last round needs no transition event.
    if (round < roundCount) {
      try {
        await router.persistAndPublish(tenantId, {
          type: 'state_transition',
          agentId: 'system',
          runId,
          tenantId,
          content: { from: `round-${round}`, to: `round-${round + 1}` },
          metadata: {},
        });
      } catch (err: any) {
        log.error(
          { error: err.message, runId, round },
          'Failed to publish round transition (continuing)',
        );
      }
      await sleep(interRoundPauseMs);
    }
  }

  // Phase 19-05: clear runs.current_round at exit so the messages route can
  // distinguish "round in flight" (current_round IS NOT NULL → queue the new
  // user message) from "post-rounds idle, watcher pending" (current_round
  // IS NULL → trigger a fresh round-table). Best-effort: a failed write
  // doesn't abort the run lifecycle (the idle-timeout watcher still owns
  // status transitions).
  try {
    const { runs: runsTable } = createTenantSchema(tenantId);
    await db
      .update(runsTable)
      .set({ currentRound: null, updatedAt: new Date() })
      .where(eq(runsTable.id, runId));
  } catch (err: any) {
    log.error(
      { error: err.message, runId },
      'Failed to clear current_round on round-table exit (continuing)',
    );
  }

  log.info(
    { runId, agentCount: agents.length, roundCount },
    'Round-table discussion complete; run stays executing until idle-timeout',
  );
  // Phase 19: DO NOT mark the run completed here. Plan 19-02's idle-timeout
  // watcher is the sole writer of `status: 'completed'`. The previous
  // unconditional write (old routes.ts:413) is REMOVED on purpose —
  // silence-driven lifecycle per UX-19-01.
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
