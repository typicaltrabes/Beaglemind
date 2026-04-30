/**
 * Phase 19-02 — BullMQ-backed idle-timeout scheduler.
 *
 * Production implementation of the IdleTimeoutScheduler interface that the
 * MessageRouter consumes. Wired by apps/agent-hub/src/index.ts and called from
 * MessageRouter.touchLastEventAtAndReschedule on every event publish.
 *
 * Why remove + add (instead of "update delay"): BullMQ does not support
 * mutating a delayed job's delay. The supported idiom is to remove the
 * existing job at jobId and add a fresh one. `.remove` tolerates a missing
 * jobId (returns 0), so the first call for a run + every subsequent
 * reschedule both go through the same code path.
 *
 * Why a custom jobId (`${tenantId}__${runId}`):
 *   - jobId-deduped: even if the worker is horizontally scaled, only one
 *     instance can pick up the job (T-19-02-02 in the threat register).
 *   - Tenant-isolated: tenantId is a UUID, no collision possible across
 *     tenants (T-19-02-05).
 *   - Predictable for `.remove` — no need to scan jobs by data.
 */

import { Queue, type ConnectionOptions } from 'bullmq';
import type { IdleTimeoutScheduler } from './message-router';

export class BullMQIdleTimeoutScheduler implements IdleTimeoutScheduler {
  private queue: Queue;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue('idle-timeout', { connection });
  }

  async schedule(tenantId: string, runId: string, idleTimeoutMinutes: number): Promise<void> {
    // BullMQ rejects custom jobIds containing `:` ("Custom Id cannot contain :").
    // Use `__` as separator. Both halves are UUIDs so collision is impossible.
    const jobId = `${tenantId}__${runId}`;
    // BullMQ doesn't support "update delay" on a delayed job — remove + add.
    // .remove tolerates a missing jobId (returns 0); .catch silences the
    // edge case where Redis returns an unexpected error so a single failed
    // remove never blocks the new schedule.
    await this.queue.remove(jobId).catch(() => 0);
    await this.queue.add(
      'idle-timeout',
      { tenantId, runId },
      {
        jobId,
        delay: idleTimeoutMinutes * 60_000,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
