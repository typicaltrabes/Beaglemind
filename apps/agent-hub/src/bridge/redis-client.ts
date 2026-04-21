import Redis from 'ioredis';
import { config } from '../config';
import { createChildLogger } from '../logger';

const log = createChildLogger({ component: 'redis' });

/** Redis publisher instance for publishing events to channels. */
export const redisPub = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redisPub.on('connect', () => {
  log.info('Redis publisher connected');
});

redisPub.on('error', (err) => {
  log.error({ err: err.message }, 'Redis publisher error');
});

redisPub.on('close', () => {
  log.info('Redis publisher connection closed');
});

/** Graceful shutdown: disconnect Redis publisher. */
export async function closeRedis(): Promise<void> {
  log.info('Closing Redis connections');
  await redisPub.quit();
}
