/**
 * Phase 17.1-07 (DEFECT-17-C) — EventStore.list contract tests.
 *
 * The hub's `runRoundTable` needs to load prior conversation events for a run
 * BEFORE composing each agent's prompt, so follow-up messages on a `completed`
 * run produce a context-aware fan-out instead of a context-blind one.
 *
 * `EventStore.list(tenantId, runId, opts?)` is the read counterpart to
 * `EventStore.persist`. It must:
 *   1. Return events for the run ordered by sequenceNumber ASC.
 *   2. Honor an optional `limit` capping at the N most recent events
 *      (highest sequenceNumber), still in ascending order.
 *   3. Filter strictly by runId — cross-run leakage is a security threat
 *      (T-17-1-07-03 in the plan's threat register).
 *
 * Pattern follows routes.test.ts: mock the drizzle `db.select().from()...`
 * chain. Real DB / migrations not exercised — that lives in deploy UAT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @beagle-console/db so EventStore.list's createTenantSchema call returns
// a deterministic shape and the drizzle `select()` chain is observable.
vi.mock('@beagle-console/db', () => ({
  createTenantSchema: vi.fn(() => ({
    events: { runId: 'runId', sequenceNumber: 'sequenceNumber' },
  })),
}));

import { EventStore } from '../events/event-store';
import type { SequenceCounter } from '../events/sequence-counter';

const TENANT_ID = 'a5e7f2c1-0b89-4d6a-b3e2-1c9f8a4d7b56';
const RUN_ID_A = '6e8a4c12-9b3d-4f25-8a17-2c5b0d8a9e44';
const RUN_ID_B = '8f9b5d23-ac4e-4a36-9b28-3d6c1e9a0f55';

/**
 * Build a fake drizzle row matching the events table shape EventStore.list
 * pulls back. `sequenceNumber` is the only field these tests assert ordering
 * on; the rest is filler so the .map() projection has fields to read.
 */
function buildRow(seq: number, opts?: { runId?: string; agentId?: string; text?: string }) {
  return {
    runId: opts?.runId ?? RUN_ID_A,
    sequenceNumber: seq,
    type: 'agent_message',
    agentId: opts?.agentId ?? 'mo',
    content: { text: opts?.text ?? `msg-${seq}` },
    metadata: {},
    createdAt: new Date('2026-04-29T00:00:00.000Z'),
  };
}

/**
 * Build a mock drizzle db whose select->from->where->orderBy->limit chain
 * resolves to the provided rows. The chain is built lazily so we can assert
 * which methods were called and with what.
 */
function buildMockDb(rows: any[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const orderByFn = vi.fn(() => ({ limit: limitFn }));
  const whereFn = vi.fn(() => ({ orderBy: orderByFn }));
  const fromFn = vi.fn(() => ({ where: whereFn }));
  const selectFn = vi.fn(() => ({ from: fromFn }));
  return {
    db: { select: selectFn } as any,
    spies: { selectFn, fromFn, whereFn, orderByFn, limitFn },
  };
}

describe('EventStore.list — Phase 17.1-07 (DEFECT-17-C history load)', () => {
  let counter: SequenceCounter;

  beforeEach(() => {
    counter = { next: vi.fn(), reset: vi.fn() } as unknown as SequenceCounter;
  });

  it('returns events ordered by sequenceNumber ASCENDING for a runId', async () => {
    // DB returns the rows ordered DESC (most recent first) because EventStore.list
    // queries with orderBy(desc(sequenceNumber)).limit(N) and reverses them
    // client-side to hand the caller an ASCENDING array. Verify both: the call
    // pattern (DESC + limit) AND the returned ordering (ASC).
    const dbRowsDesc = [
      buildRow(5, { text: 'newest' }),
      buildRow(4),
      buildRow(3),
      buildRow(2),
      buildRow(1, { text: 'oldest' }),
    ];
    const { db } = buildMockDb(dbRowsDesc);
    const store = new EventStore(db, counter);

    const result = await store.list(TENANT_ID, RUN_ID_A);

    expect(result).toHaveLength(5);
    // Ascending order in the returned array
    const seqs = result.map((e) => e.sequenceNumber);
    expect(seqs).toEqual([1, 2, 3, 4, 5]);
    // Oldest content sits at the front, newest at the back
    expect((result[0]!.content as { text: string }).text).toBe('oldest');
    expect((result[4]!.content as { text: string }).text).toBe('newest');
  });

  it('honors opts.limit — returns only the N most recent events, still ascending', async () => {
    // Caller asks for the 10 most recent. DB returns 10 rows DESC; list reverses
    // to ASC. Verify limit was passed through to the drizzle chain AND the
    // output is the right size + ordering.
    const dbRowsDesc = Array.from({ length: 10 }, (_, i) => buildRow(20 - i)); // seqs 20..11 desc
    const { db, spies } = buildMockDb(dbRowsDesc);
    const store = new EventStore(db, counter);

    const result = await store.list(TENANT_ID, RUN_ID_A, { limit: 10 });

    expect(result).toHaveLength(10);
    // Drizzle .limit(10) was called with the right N
    expect(spies.limitFn).toHaveBeenCalledWith(10);
    // Ascending in the returned array, covering seqs 11..20
    const seqs = result.map((e) => e.sequenceNumber);
    expect(seqs).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('uses default limit of 30 when opts.limit is omitted', async () => {
    // Cap is documented in the plan: 30 events default. Confirm no opts → 30.
    const { db, spies } = buildMockDb([]);
    const store = new EventStore(db, counter);

    await store.list(TENANT_ID, RUN_ID_A);

    expect(spies.limitFn).toHaveBeenCalledWith(30);
  });

  it('filters strictly by runId — cross-run isolation (T-17-1-07-03)', async () => {
    // Two runs in the same tenant. list(RUN_ID_B) must NOT return RUN_ID_A's
    // events. The drizzle where() clause is the one and only scope, so we
    // verify it was called (with eq(runId, RUN_ID_B)) and that the returned
    // shape carries only the requested runId's rows.
    const dbRowsDesc = [
      buildRow(2, { runId: RUN_ID_B, text: 'b-2' }),
      buildRow(1, { runId: RUN_ID_B, text: 'b-1' }),
    ];
    const { db, spies } = buildMockDb(dbRowsDesc);
    const store = new EventStore(db, counter);

    const result = await store.list(TENANT_ID, RUN_ID_B);

    // where() was the gate
    expect(spies.whereFn).toHaveBeenCalled();
    // Every returned envelope carries the requested runId
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.runId === RUN_ID_B)).toBe(true);
    // No row from RUN_ID_A leaked through
    expect(result.find((e) => e.runId === RUN_ID_A)).toBeUndefined();
  });

  it('returns envelopes with the standard HubEventEnvelope shape (type, agentId, runId, tenantId, content, metadata, sequenceNumber, timestamp)', async () => {
    // The envelope shape must be compatible with what `runRoundTable` reads to
    // build the PRIOR CONVERSATION block — agentId + content.text are the
    // load-bearing fields. timestamp must be ISO-string (createdAt is a Date).
    const dbRowsDesc = [buildRow(1, { agentId: 'jarvis', text: 'first reply' })];
    const { db } = buildMockDb(dbRowsDesc);
    const store = new EventStore(db, counter);

    const result = await store.list(TENANT_ID, RUN_ID_A);

    expect(result).toHaveLength(1);
    const env = result[0]!;
    expect(env.type).toBe('agent_message');
    expect(env.agentId).toBe('jarvis');
    expect(env.runId).toBe(RUN_ID_A);
    expect(env.tenantId).toBe(TENANT_ID);
    expect(env.sequenceNumber).toBe(1);
    expect(env.content).toEqual({ text: 'first reply' });
    // timestamp must be a string (ISO), not a Date instance
    expect(typeof env.timestamp).toBe('string');
    expect(env.timestamp).toBe('2026-04-29T00:00:00.000Z');
  });
});
