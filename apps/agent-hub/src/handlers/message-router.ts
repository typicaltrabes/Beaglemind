import { OpenClawInbound, type HubEventEnvelope } from '@beagle-console/shared';
import { eq } from 'drizzle-orm';
import { db, createTenantSchema } from '@beagle-console/db';
import type { EventStore, PersistInput } from '../events/event-store';
import type { RedisPublisher } from '../bridge/redis-publisher';
import type { Logger } from 'pino';
import { notifyPlanApproval, notifyQuestion } from '../notifications/push-service';

/**
 * Map an OpenClaw inbound message to a partial HubEventEnvelope (D-05, D-06).
 * The returned object has no sequenceNumber or timestamp -- those are assigned by EventStore.
 */
export function mapOpenClawToEvent(
  agentId: string,
  msg: OpenClawInbound,
  runId: string,
  tenantId: string,
): PersistInput {
  switch (msg.type) {
    case 'chat.response':
      return {
        type: 'agent_message',
        agentId,
        runId,
        tenantId,
        content: { text: msg.content },
        metadata: { done: true },
      };
    case 'chat.stream':
      return {
        type: 'agent_message',
        agentId,
        runId,
        tenantId,
        content: { text: msg.content },
        metadata: { done: msg.done, streaming: true },
      };
    case 'chat.typing':
      return {
        type: 'system',
        agentId,
        runId,
        tenantId,
        content: { event: 'typing' },
        metadata: {},
      };
    case 'chat.error':
      return {
        type: 'system',
        agentId,
        runId,
        tenantId,
        content: { event: 'error', error: msg.error },
        metadata: {},
      };
  }
}

/**
 * Phase 19-02: thin scheduler abstraction so MessageRouter doesn't take a
 * hard dep on bullmq (and tests don't need a Redis-backed Queue). The
 * production wiring is `BullMQIdleTimeoutScheduler` in
 * `apps/agent-hub/src/handlers/idle-timeout-scheduler.ts`.
 */
export interface IdleTimeoutScheduler {
  schedule(tenantId: string, runId: string, idleTimeoutMinutes: number): Promise<void>;
}

/**
 * Orchestrates the full message pipeline:
 * parse -> map -> persist (D-08) -> publish to Redis
 *
 * Phase 19-02: every persistAndPublish (and handleAgentMessage that flows
 * through it via the bridge) ALSO touches `runs.last_event_at = NOW()` and
 * reschedules the idle-timeout watcher. Both side-effects are best-effort —
 * a DB or Redis failure on either logs and continues so the publish itself
 * is never rolled back.
 */
export class MessageRouter {
  constructor(
    private readonly eventStore: EventStore,
    private readonly publisher: RedisPublisher,
    private readonly log: { debug: Function; warn: Function; error: Function },
    private readonly idleScheduler?: IdleTimeoutScheduler,
  ) {}

  /**
   * Handle an inbound agent message through the full pipeline.
   * 1. Parse with Zod (drop invalid)
   * 2. Map to HubEventEnvelope format
   * 3. Persist to DB (D-08: before broadcast)
   * 4. Publish to Redis
   */
  async handleAgentMessage(
    agentId: string,
    rawMsg: unknown,
    runId: string,
    tenantId: string,
  ): Promise<void> {
    // Step 1: Validate with Zod (T-03-08: drop invalid messages)
    const parsed = OpenClawInbound.safeParse(rawMsg);
    if (!parsed.success) {
      this.log.warn({ agentId, rawMsg, error: parsed.error }, 'Invalid inbound message, dropping');
      return;
    }

    // Step 2: Map to event format
    const event = mapOpenClawToEvent(agentId, parsed.data, runId, tenantId);

    // Step 3: Persist BEFORE broadcast (D-08)
    const persisted = await this.eventStore.persist(tenantId, event);

    // Step 4: Publish to Redis (only after successful persistence)
    await this.publisher.publish(persisted);

    // Step 5: Phase 19-02 — touch last_event_at + reschedule idle-timeout
    // watcher. Best-effort; failures don't propagate.
    await this.touchLastEventAtAndReschedule(tenantId, runId);

    this.log.debug(
      { agentId, runId, sequenceNumber: persisted.sequenceNumber, type: persisted.type },
      'Message routed through pipeline',
    );
  }

  /**
   * Persist an event directly (used by HTTP routes for user/system events).
   * Also publishes to Redis after persistence.
   * Triggers push notifications for governance events (D-08).
   */
  async persistAndPublish(tenantId: string, event: PersistInput): Promise<HubEventEnvelope> {
    const persisted = await this.eventStore.persist(tenantId, event);
    await this.publisher.publish(persisted);

    // Phase 19-02: every event publish keeps the run alive — touch
    // last_event_at and reschedule the idle-timeout watcher. Best-effort.
    await this.touchLastEventAtAndReschedule(tenantId, event.runId);

    // D-08: Trigger push notifications for governance events
    // Wrapped in try/catch so push failures never break the event pipeline
    this.triggerPushNotification(persisted).catch((err) => {
      this.log.error({ err, type: persisted.type }, 'Push notification failed (non-blocking)');
    });

    return persisted;
  }

  /**
   * Phase 19-02: post-publish bookkeeping for the silence-driven lifecycle.
   *
   * 1. Touch `runs.last_event_at = NOW()` (best-effort): used by debugging /
   *    future cancel-old-runs sweeps. Also update `runs.updated_at`. Failure
   *    logs but does not break the publish.
   * 2. Reschedule the BullMQ `idle-timeout` watcher (best-effort): reads
   *    `runs.idle_timeout_minutes` (defaults to 7 if missing) and asks the
   *    scheduler to re-add a delayed job at jobId `${tenantId}__${runId}`.
   *    Failure logs but does not break the publish.
   *
   * If `idleScheduler` is undefined (e.g. unit tests with no Redis available)
   * the reschedule step is silently skipped — the last_event_at touch still
   * runs because it doesn't need Redis.
   */
  private async touchLastEventAtAndReschedule(
    tenantId: string,
    runId: string,
  ): Promise<void> {
    // 1. Touch last_event_at
    let idleMin = 7;
    try {
      const { runs: runsTable } = createTenantSchema(tenantId);
      await db
        .update(runsTable)
        .set({ lastEventAt: new Date(), updatedAt: new Date() })
        .where(eq(runsTable.id, runId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(
        { err: message, runId },
        'Failed to update last_event_at (continuing)',
      );
    }

    // 2. Reschedule idle-timeout watcher (only if scheduler is wired)
    if (!this.idleScheduler) return;

    try {
      const { runs: runsTable } = createTenantSchema(tenantId);
      const cfg = await db
        .select({ idleTimeoutMinutes: runsTable.idleTimeoutMinutes })
        .from(runsTable)
        .where(eq(runsTable.id, runId))
        .limit(1);
      idleMin = cfg[0]?.idleTimeoutMinutes ?? 7;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(
        { err: message, runId },
        'Failed to read idle_timeout_minutes; using default 7 (continuing)',
      );
    }

    try {
      await this.idleScheduler.schedule(tenantId, runId, idleMin);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(
        { err: message, runId },
        'Failed to reschedule idle-timeout watcher (continuing)',
      );
    }
  }

  /**
   * Fire push notification for plan_proposal and question events.
   * Extracts projectId from event content/metadata for the notification URL.
   */
  private async triggerPushNotification(event: HubEventEnvelope): Promise<void> {
    const content = event.content as Record<string, unknown>;
    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const projectId = (content.projectId ?? metadata.projectId ?? '') as string;

    if (event.type === 'plan_proposal') {
      const planName = (content.planName ?? content.text ?? 'New plan') as string;
      await notifyPlanApproval(event.tenantId, event.runId, projectId, planName);
    } else if (event.type === 'question') {
      const agentName = event.agentId;
      const questionText = (content.text ?? content.question ?? '') as string;
      await notifyQuestion(event.tenantId, event.runId, projectId, agentName, questionText);
    }
  }
}
