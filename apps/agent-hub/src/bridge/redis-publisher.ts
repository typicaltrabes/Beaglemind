import type Redis from 'ioredis';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { createChildLogger } from '../logger';

const log = createChildLogger({ component: 'redis-publisher' });

/**
 * Publishes HubEventEnvelope messages to Redis pub/sub channels (D-10, D-11, D-12).
 * Channel naming: run:{tenantId}:{runId}
 */
export class RedisPublisher {
  constructor(private readonly redis: Redis) {}

  /**
   * Publish a complete event to the run's Redis channel.
   * Called AFTER successful persistence (D-08: persist before broadcast).
   */
  async publish(event: HubEventEnvelope): Promise<void> {
    const channel = `run:${event.tenantId}:${event.runId}`;
    const payload = JSON.stringify(event);
    await this.redis.publish(channel, payload);

    log.debug(
      {
        channel,
        agentId: event.agentId,
        runId: event.runId,
        sequenceNumber: event.sequenceNumber,
        type: event.type,
      },
      'Event published to Redis',
    );
  }
}
