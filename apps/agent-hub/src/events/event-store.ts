import { createTenantSchema } from '@beagle-console/db';
import { type HubEventEnvelope } from '@beagle-console/shared';
import type { SequenceCounter } from './sequence-counter';
import { createChildLogger } from '../logger';

const log = createChildLogger({ component: 'event-store' });

/** Input for persisting an event -- sequenceNumber and timestamp are assigned by the store. */
export type PersistInput = Omit<HubEventEnvelope, 'sequenceNumber' | 'timestamp'>;

/**
 * Event persistence layer (D-07, D-08).
 * Assigns sequence numbers and timestamps, then inserts into tenant events table.
 */
export class EventStore {
  constructor(
    private readonly db: any,
    private readonly counter: SequenceCounter,
  ) {}

  /**
   * Persist an event to the tenant's events table.
   * Assigns sequenceNumber (via SequenceCounter) and timestamp before insert.
   * Returns the complete HubEventEnvelope.
   */
  async persist(tenantId: string, event: PersistInput): Promise<HubEventEnvelope> {
    const { events } = createTenantSchema(tenantId);
    const sequenceNumber = await this.counter.next(event.runId, this.db, events);
    const timestamp = new Date().toISOString();

    const envelope: HubEventEnvelope = {
      ...event,
      sequenceNumber,
      timestamp,
    };

    try {
      await this.db.insert(events).values({
        runId: event.runId,
        sequenceNumber,
        type: event.type,
        agentId: event.agentId,
        content: event.content,
        metadata: event.metadata ?? {},
        // createdAt uses defaultNow()
      });
    } catch (err) {
      log.error({ err, runId: event.runId, sequenceNumber }, 'Failed to persist event');
      throw err;
    }

    log.debug(
      { runId: event.runId, sequenceNumber, type: event.type, agentId: event.agentId },
      'Event persisted',
    );

    return envelope;
  }
}
