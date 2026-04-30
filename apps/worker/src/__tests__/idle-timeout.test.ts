/**
 * Phase 19-02 Task 1 — processIdleTimeout unit tests.
 *
 * The processor is the SOLE writer of `runs.status = 'completed'`, so its
 * correctness matters for both UX-19-01 (silence-driven lifecycle) and
 * UX-19-04 (idle-timeout watcher). Tests cover the four guard paths:
 *   1. Happy path: executing → completed + publish
 *   2. No-op: already-completed (no DB write, no publish)
 *   3. No-op: cancelled (no DB write, no publish)
 *   4. No-op + warn: missing run row
 *   5. Resilience: publish failure does not roll back the DB write
 *
 * The drizzle `db.select().from()...limit()` and `db.update().set().where()`
 * chains are mocked. The mocked `db` exposes a `__updates` array so each test
 * can assert the .set() payload that flowed through.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock module shape: tests poke `globalThis.__mockRows` to control what the
// select chain resolves to, and read `(db as any).__updates` to assert the
// .set() payloads. `createTenantSchema` returns a runs key that the processor
// passes through to drizzle's eq() helper — eq is real, but the column it
// compares against is just an object so eq doesn't fail at runtime in tests.
vi.mock('@beagle-console/db', () => {
  const updates: any[] = [];
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => (globalThis as any).__mockRows ?? []),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn(async () => {
            updates.push(vals);
            return undefined;
          }),
        })),
      })),
      __updates: updates,
    },
    createTenantSchema: vi.fn(() => ({
      runs: { id: 'id', status: 'status' },
    })),
  };
});

import { processIdleTimeout } from '../queues/idle-timeout';
import { db } from '@beagle-console/db';

const RUN_ID = '6e8a4c12-9b3d-4f25-8a17-2c5b0d8a9e44';
const TENANT_ID = 'a5e7f2c1-0b89-4d6a-b3e2-1c9f8a4d7b56';

beforeEach(() => {
  (db as any).__updates.length = 0;
  (globalThis as any).__mockRows = [];
});

describe('processIdleTimeout', () => {
  it('flips executing → completed and publishes state_transition', async () => {
    (globalThis as any).__mockRows = [{ status: 'executing' }];
    const publish = vi.fn(async () => {});

    const result = await processIdleTimeout(TENANT_ID, RUN_ID, publish);

    expect(result.skipped).toBe(false);
    expect((db as any).__updates).toHaveLength(1);
    // status flipped, currentRound cleared, updatedAt is a Date
    expect((db as any).__updates[0]).toMatchObject({
      status: 'completed',
      currentRound: null,
    });
    expect((db as any).__updates[0].updatedAt).toBeInstanceOf(Date);
    // publish carries the canonical state_transition payload
    expect(publish).toHaveBeenCalledWith(TENANT_ID, RUN_ID, {
      from: 'executing',
      to: 'completed',
      triggeredBy: 'idle-timeout',
    });
  });

  it('no-ops when run is already completed (no DB write, no publish)', async () => {
    (globalThis as any).__mockRows = [{ status: 'completed' }];
    const publish = vi.fn(async () => {});

    const result = await processIdleTimeout(TENANT_ID, RUN_ID, publish);

    expect(result.skipped).toBe(true);
    expect((db as any).__updates).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('no-ops when run is cancelled (no DB write, no publish)', async () => {
    (globalThis as any).__mockRows = [{ status: 'cancelled' }];
    const publish = vi.fn(async () => {});

    const result = await processIdleTimeout(TENANT_ID, RUN_ID, publish);

    expect(result.skipped).toBe(true);
    expect((db as any).__updates).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('no-ops + warns when run row is missing', async () => {
    (globalThis as any).__mockRows = [];
    const publish = vi.fn(async () => {});

    const result = await processIdleTimeout(TENANT_ID, RUN_ID, publish);

    expect(result.skipped).toBe(true);
    expect((db as any).__updates).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not roll back the DB write when publish fails', async () => {
    (globalThis as any).__mockRows = [{ status: 'executing' }];
    const publish = vi.fn(async () => {
      throw new Error('redis down');
    });

    // Processor must NOT rethrow — a publish failure is logged but the DB
    // status update has already committed and is the source of truth.
    const result = await processIdleTimeout(TENANT_ID, RUN_ID, publish);

    expect(result.skipped).toBe(false);
    expect((db as any).__updates).toHaveLength(1);
    expect((db as any).__updates[0]).toMatchObject({ status: 'completed' });
    expect(publish).toHaveBeenCalled();
  });
});
