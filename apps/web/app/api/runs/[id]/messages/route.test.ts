/**
 * Phase 19-05 — POST /api/runs/[id]/messages branches on runs.current_round.
 *
 * Behaviors verified:
 *   1. Round in flight (current_round != null): the route inserts an event
 *      with metadata.queuedForNextRound=true, SKIPS hubClient.startRun, and
 *      returns { ok: true, queued: true }.
 *   2. Idle (current_round IS NULL): the route falls through to the existing
 *      flow — runs.status='executing' update + hubClient.startRun, no
 *      queued-event insert. Returns { ok: true } (queued absent or false).
 *   3. Queued path preserves attachmentIds in the event content.
 *
 * Pattern follows attachments/route.test.ts: mock requireTenantContext +
 * getTenantDb so the test bypasses Better Auth and Postgres entirely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ----------------------------------------------------------------

const mockRequireTenantContext = vi.fn();
const mockUpdateWhere = vi.fn(async () => undefined);
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockSelectLimit = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const insertedRows: Array<Record<string, unknown>> = [];
const mockInsertValues = vi.fn(async (row: Record<string, unknown>) => {
  insertedRows.push(row);
});
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

// db.execute is used by the route to compute MAX(sequence_number) + 1 via a
// raw SQL fragment. Tests control its return value to drive the next-seq
// branch.
const mockExecute = vi.fn(async () => [{ next_seq: 1 }]);

vi.mock('@/lib/get-tenant', () => ({
  requireTenantContext: () => mockRequireTenantContext(),
  getTenantDb: (_tenantId: string) => ({
    db: {
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
      execute: mockExecute,
    },
    schema: {
      runs: { id: 'id', currentRound: 'currentRound', status: 'status' },
      events: { runId: 'runId', sequenceNumber: 'sequenceNumber' },
      artifacts: {
        id: 'id',
        runId: 'runId',
        agentId: 'agentId',
        filename: 'filename',
        mimeType: 'mimeType',
        sizeBytes: 'sizeBytes',
        extractedText: 'extractedText',
        description: 'description',
        minioKey: 'minioKey',
      },
    },
  }),
}));

const mockStartRun = vi.fn(async () => ({ ok: true }));
vi.mock('@/lib/api/hub-client', () => ({
  hubClient: {
    startRun: (...args: unknown[]) => mockStartRun(...(args as [any])),
  },
}));

// MinIO + buildAttachmentBlock shouldn't be invoked in these tests (no
// attachment fetches in the queued/idle text-only paths) but mocks must be
// in place so any incidental import resolves cleanly.
vi.mock('@beagle-console/db', () => ({
  getMinioClient: () => ({ send: vi.fn() }),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class FakeGetObjectCommand {},
}));

vi.mock('@/lib/attachment-block', () => ({
  buildAttachmentBlock: () => '',
}));

import { POST } from './route';

// Real RFC 4122 v4 UUIDs — Zod's strict uuid format.
const RUN_ID = '11111111-2222-4333-8444-555555555555';
const TENANT_ID = '22222222-3333-4444-8555-666666666666';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request(`http://test/api/runs/${RUN_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: RUN_ID });

describe('POST /api/runs/[id]/messages — Plan 19-05 queue branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedRows.length = 0;
    mockRequireTenantContext.mockResolvedValue({
      session: { user: { id: 'user-1' } },
      tenantId: TENANT_ID,
    });
    mockExecute.mockResolvedValue([{ next_seq: 7 }]);
  });

  it('queues message when current_round is non-null (in-flight)', async () => {
    // runs.select returns currentRound=2 → in-flight.
    mockSelectLimit.mockResolvedValue([
      { currentRound: 2, status: 'executing' },
    ]);

    const res = await POST(
      makeRequest({ content: 'mid-round message', attachmentIds: [] }),
      { params },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; queued?: boolean };
    expect(body).toEqual({ ok: true, queued: true });

    // Inserted exactly one event with the queue flag.
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    const inserted = insertedRows[0];
    expect(inserted).toBeDefined();
    expect(inserted!.runId).toBe(RUN_ID);
    expect(inserted!.type).toBe('agent_message');
    expect(inserted!.agentId).toBe('user');
    expect(inserted!.content).toEqual({ text: 'mid-round message' });
    expect(inserted!.metadata).toEqual({ queuedForNextRound: true });
    expect(inserted!.sequenceNumber).toBe(7);

    // Hub startRun MUST NOT have been called — the queue path bypasses it.
    expect(mockStartRun).not.toHaveBeenCalled();
    // No runs.update either (no status flip in queue path).
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('triggers fresh round-table when current_round is NULL (idle)', async () => {
    // runs.select returns currentRound=null → idle.
    mockSelectLimit.mockResolvedValue([
      { currentRound: null, status: 'completed' },
    ]);

    const res = await POST(
      makeRequest({ content: 'follow-up after completion', attachmentIds: [] }),
      { params },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; queued?: boolean };
    // Existing path returns { ok: true } — no queued field (or queued=false)
    expect(body.ok).toBe(true);
    expect(body.queued).not.toBe(true);

    // The idle path updates runs.status='executing' and calls hubClient.startRun.
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockStartRun).toHaveBeenCalledTimes(1);
    const startRunArg = mockStartRun.mock.calls[0]?.[0];
    expect(startRunArg).toMatchObject({
      runId: RUN_ID,
      tenantId: TENANT_ID,
      prompt: 'follow-up after completion',
    });

    // No direct event insert — the hub owns persistence for the idle path.
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('preserves attachmentIds in queued event content', async () => {
    mockSelectLimit.mockResolvedValue([
      { currentRound: 1, status: 'executing' },
    ]);

    const attachmentIds = [
      'aaaaaaaa-1111-4111-8111-111111111111',
      'bbbbbbbb-2222-4222-8222-222222222222',
    ];

    const res = await POST(
      makeRequest({ content: 'with attachments', attachmentIds }),
      { params },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; queued?: boolean };
    expect(body).toEqual({ ok: true, queued: true });

    expect(insertedRows).toHaveLength(1);
    const inserted = insertedRows[0]!;
    expect(inserted.content).toEqual({
      text: 'with attachments',
      attachmentIds,
    });
    expect(inserted.metadata).toEqual({ queuedForNextRound: true });
    // Hub still skipped — attachments don't change that.
    expect(mockStartRun).not.toHaveBeenCalled();
  });
});
