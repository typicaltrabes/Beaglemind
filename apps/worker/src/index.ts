/**
 * Phase 19-02 Task 2 — apps/worker boot.
 *
 * Replaces the placeholder heartbeat with a real BullMQ-backed idle-timeout
 * watcher. The worker is the SOLE writer of `runs.status = 'completed'` and
 * the SOLE emitter of the executing→completed state_transition (Plan 19-01
 * removed the auto-complete path from runRoundTable).
 *
 * Lifecycle:
 *   1. agent-hub schedules a delayed BullMQ job on every event publish (jobId
 *      = `${tenantId}:${runId}`, delay = idle_timeout_minutes × 60_000).
 *   2. When the delay elapses we read the run's current status; if still
 *      executing, flip to completed + clear current_round + publish a
 *      state_transition on the run channel.
 *   3. SSE consumers in apps/web pick up the publish on
 *      `run:${tenantId}:${runId}` (the format this hub already uses — verified
 *      against apps/agent-hub/src/bridge/redis-publisher.ts) and flip the
 *      run-status chip in real time.
 *
 * Restart-survival is automatic: BullMQ delayed jobs persist in Redis.
 */

import Redis from 'ioredis';
import pino from 'pino';
import { sql } from 'drizzle-orm';
import { db, createTenantSchema } from '@beagle-console/db';
import {
  createIdleTimeoutWorker,
  buildRedisConnection,
} from './queues/idle-timeout';

const log = pino({ name: 'worker' });

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Plain Redis publisher for state_transition events. Mirrors the channel
// convention used by apps/agent-hub/src/bridge/redis-publisher.ts:
//   `run:${event.tenantId}:${event.runId}`
// so SSE consumers see watcher-emitted events on the same stream as agent
// events. Verified against that file at the time of authoring; if it changes,
// update both sides together.
const pubRedis = new Redis(REDIS_URL);

pubRedis.on('error', (err) => {
  log.error({ err: err.message }, 'Redis publisher error');
});

/**
 * Persist a `state_transition` event row in the tenant's events table AND
 * publish it on the run channel. The persist step matters for SSE replay
 * (apps/web/app/api/runs/[id]/messages route) — users who load the run after
 * the watcher fires need the transition to appear in history; live-only
 * pub/sub would leave their UI showing `executing` forever.
 *
 * Sequence number: the hub's SequenceCounter is in-memory and not shared with
 * this worker, so we compute MAX(sequence_number)+1 directly. Safe because
 * the run is going terminal — no further events expected after this one.
 */
async function publishStateTransition(
  tenantId: string,
  runId: string,
  payload: { from: string; to: string; triggeredBy: string },
): Promise<void> {
  const { events } = createTenantSchema(tenantId);

  // 1. Compute next sequence number for this run.
  const maxRows = (await db
    .select({ max: sql<number>`COALESCE(MAX(${events.sequenceNumber}), 0)::int` })
    .from(events)
    .where(sql`${events.runId} = ${runId}`)) as Array<{ max: number }>;
  const sequenceNumber = (maxRows[0]?.max ?? 0) + 1;
  const createdAt = new Date();

  // 2. Persist the state_transition row so SSE replay sees it on next load.
  await db.insert(events).values({
    runId,
    sequenceNumber,
    type: 'state_transition',
    agentId: 'system',
    content: payload,
    metadata: {},
  });

  // 3. Publish on the run channel — same format as the hub's RedisPublisher.
  const envelope = {
    type: 'state_transition',
    agentId: 'system',
    runId,
    tenantId,
    sequenceNumber,
    content: payload,
    metadata: {},
    timestamp: createdAt.toISOString(),
  };
  const channel = `run:${tenantId}:${runId}`;
  await pubRedis.publish(channel, JSON.stringify(envelope));

  log.debug(
    { channel, sequenceNumber, runId, tenantId },
    'state_transition published by idle-timeout watcher',
  );
}

const worker = createIdleTimeoutWorker({
  connection: buildRedisConnection(REDIS_URL),
  publishStateTransition,
});

worker.on('completed', (job) => {
  log.info({ jobId: job.id }, 'idle-timeout job completed');
});
worker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, 'idle-timeout job failed');
});
worker.on('error', (err) => {
  log.error({ err: err.message }, 'idle-timeout worker error');
});

log.info({ queue: 'idle-timeout' }, 'Worker started');

async function shutdown(signal: string) {
  log.info({ signal }, 'Worker shutting down (graceful)');
  // Stop accepting new jobs; let in-flight jobs finish (BullMQ default
  // behavior with worker.close()). Pending delayed jobs persist in Redis
  // and resume on next worker boot.
  await worker.close();
  await pubRedis.quit().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
