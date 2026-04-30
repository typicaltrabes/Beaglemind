/**
 * Phase 19-02 — BullMQ idle-timeout queue + worker.
 *
 * The watcher is the SOLE writer of `runs.status = 'completed'` and the SOLE
 * emitter of the `executing → completed` state_transition event. Plan 19-01
 * removed the auto-complete write from `runRoundTable`, so this module is the
 * end-of-life signal for every run.
 *
 * Wiring:
 * - The agent-hub schedules a delayed job via BullMQ on every event publish
 *   (see apps/agent-hub/src/handlers/idle-timeout-scheduler.ts). The jobId is
 *   `${tenantId}__${runId}` so that re-scheduling collapses the prior pending
 *   job into the new one (BullMQ's delete-then-add idiom).
 * - When the delay elapses, this worker's processor (`processIdleTimeout`)
 *   reads the run's current status; if still `executing` it flips to
 *   `completed`, clears `current_round`, and publishes a `state_transition`
 *   event so the SSE consumer in apps/web flips the run-status chip.
 *
 * Restart-survival is automatic: BullMQ delayed jobs persist in Redis so a
 * worker restart simply resumes the timers.
 */

import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, createTenantSchema } from '@beagle-console/db';
import pino from 'pino';

const log = pino({ name: 'idle-timeout' });

export const IDLE_TIMEOUT_QUEUE = 'idle-timeout';

interface IdleTimeoutJob {
  tenantId: string;
  runId: string;
}

export interface IdleTimeoutDeps {
  connection: ConnectionOptions;
  /**
   * Publish handler — given a tenant + event, push to Redis on the same
   * channel the agent-hub uses for SSE fan-out. Dependency-injected so
   * tests can substitute a recorder.
   */
  publishStateTransition(
    tenantId: string,
    runId: string,
    payload: { from: string; to: string; triggeredBy: string },
  ): Promise<void>;
}

/**
 * Build the queue. Used by the apps/agent-hub side so it can enqueue jobs;
 * the worker holds its own Queue instance internally if it needs queue admin.
 */
export function createIdleTimeoutQueue(connection: ConnectionOptions): Queue<IdleTimeoutJob> {
  return new Queue<IdleTimeoutJob>(IDLE_TIMEOUT_QUEUE, { connection });
}

/** Build the worker (used by apps/worker only). */
export function createIdleTimeoutWorker(deps: IdleTimeoutDeps): Worker<IdleTimeoutJob> {
  return new Worker<IdleTimeoutJob>(
    IDLE_TIMEOUT_QUEUE,
    async (job) => {
      const { tenantId, runId } = job.data;
      await processIdleTimeout(tenantId, runId, deps.publishStateTransition);
    },
    { connection: deps.connection, concurrency: 4 },
  );
}

/**
 * Pure processor — exported so tests can call directly without BullMQ.
 *
 * The status check before the UPDATE is the deduplication guard: even if two
 * worker instances pick up the same job (jobId-deduped at the queue level so
 * this should not happen) or the run was completed by some other path while
 * this job sat in the delayed-set, the `if (status terminal) return` short
 * circuit prevents a double-publish of the state_transition.
 */
export async function processIdleTimeout(
  tenantId: string,
  runId: string,
  publishStateTransition: IdleTimeoutDeps['publishStateTransition'],
): Promise<{ skipped: boolean }> {
  const { runs: runsTable } = createTenantSchema(tenantId);

  // Read current status — atomic check before write.
  const rows = await db
    .select({ status: runsTable.status })
    .from(runsTable)
    .where(eq(runsTable.id, runId))
    .limit(1);

  const status = rows[0]?.status;
  if (!status) {
    log.warn({ tenantId, runId }, 'Run not found; idle-timeout no-op');
    return { skipped: true };
  }
  if (status === 'completed' || status === 'cancelled') {
    log.info({ tenantId, runId, status }, 'Run already terminal; idle-timeout no-op');
    return { skipped: true };
  }

  // Atomically flip to completed (one UPDATE — no read-modify-write race
  // with the round-table loop because Plan 19-01 removed the round-table's
  // status writes; this watcher is the sole writer of `completed`).
  await db
    .update(runsTable)
    .set({ status: 'completed', currentRound: null, updatedAt: new Date() })
    .where(eq(runsTable.id, runId));

  // Publish state_transition so SSE consumers flip the chip in real time.
  // Independent try/catch — DB row is the source of truth; publish failure
  // must not roll back the status update.
  try {
    await publishStateTransition(tenantId, runId, {
      from: 'executing',
      to: 'completed',
      triggeredBy: 'idle-timeout',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { err: message, tenantId, runId },
      'Failed to publish idle-timeout state_transition (run is still completed in DB)',
    );
  }

  log.info({ tenantId, runId }, 'Run flipped executing → completed by idle-timeout watcher');
  return { skipped: false };
}

/**
 * Build a BullMQ-compatible ioredis ConnectionOptions from a redis:// URL.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on the underlying ioredis
 * connection (it manages retries itself); ioredis defaults to 20 which causes
 * BullMQ to throw at startup.
 */
export function buildRedisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    maxRetriesPerRequest: null,
  };
}
