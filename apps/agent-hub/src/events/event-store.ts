import { createTenantSchema } from '@beagle-console/db';
import { type HubEventEnvelope } from '@beagle-console/shared';
import { eq, desc } from 'drizzle-orm';
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

  /**
   * Read prior events for a run (Phase 17.1-07, DEFECT-17-C).
   *
   * Returns events for the runId ordered by sequenceNumber ASCENDING — oldest
   * first, newest last — so callers can format the conversation in chronological
   * order. The query under the hood selects DESC + LIMIT N (so we keep the most
   * recent N events when the run is long) and reverses client-side to the
   * ascending order callers want.
   *
   * @param tenantId — tenant whose schema we're reading from
   * @param runId — run scope; cross-run leakage is a security threat
   *   (T-17-1-07-03), so the eq(events.runId, runId) filter is the one and only
   *   gate
   * @param opts.limit — cap at the N most recent events (default 30 per the
   *   plan's char/event budget). Used by `runRoundTable` to bound prompt size.
   */
  async list(
    tenantId: string,
    runId: string,
    opts?: { limit?: number },
  ): Promise<HubEventEnvelope[]> {
    const { events } = createTenantSchema(tenantId);
    const limit = opts?.limit ?? 30;

    const rows = await this.db
      .select()
      .from(events)
      .where(eq(events.runId, runId))
      .orderBy(desc(events.sequenceNumber))
      .limit(limit);

    // Reverse so the caller sees ascending order while we kept the DESC + LIMIT
    // semantics on the DB side (most recent N when the run is long).
    return rows.reverse().map((r: any) => ({
      type: r.type,
      agentId: r.agentId,
      runId: r.runId,
      tenantId,
      content: r.content,
      metadata: r.metadata ?? {},
      sequenceNumber: r.sequenceNumber,
      timestamp: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }));
  }
}
