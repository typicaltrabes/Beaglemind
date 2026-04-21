import { OpenClawInbound, type HubEventEnvelope } from '@beagle-console/shared';
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
 * Orchestrates the full message pipeline:
 * parse -> map -> persist (D-08) -> publish to Redis
 */
export class MessageRouter {
  constructor(
    private readonly eventStore: EventStore,
    private readonly publisher: RedisPublisher,
    private readonly log: { debug: Function; warn: Function; error: Function },
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

    // D-08: Trigger push notifications for governance events
    // Wrapped in try/catch so push failures never break the event pipeline
    this.triggerPushNotification(persisted).catch((err) => {
      this.log.error({ err, type: persisted.type }, 'Push notification failed (non-blocking)');
    });

    return persisted;
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
