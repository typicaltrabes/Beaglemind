import { describe, expect, it } from 'vitest';
import { HubEventEnvelope } from '@beagle-console/shared';
import { dbRowToEnvelope, type EventDbRow } from './sse-envelope';

// Fixture UUIDs are valid v4 (variant nibble 8/9/a/b) so they pass
// Zod's strict UUID regex. The all-1s / all-2s shape is not a valid UUID
// under Zod v4's format check.
const baseRow: EventDbRow = {
  id: 42,
  runId: '11111111-1111-4111-8111-111111111111',
  sequenceNumber: 7,
  type: 'agent_message',
  agentId: 'mo',
  content: { text: 'hello' },
  metadata: null,
  createdAt: new Date('2026-04-22T13:42:00.000Z'),
};
const tenantId = '22222222-2222-4222-8222-222222222222';

describe('dbRowToEnvelope', () => {
  it('maps createdAt (Date) to ISO-8601 timestamp', () => {
    const env = dbRowToEnvelope(baseRow, tenantId);
    expect(env.timestamp).toBe('2026-04-22T13:42:00.000Z');
  });

  it('passes tenantId from the argument (not from the row)', () => {
    const env = dbRowToEnvelope(baseRow, tenantId);
    expect(env.tenantId).toBe(tenantId);
    // The row has no tenantId column at all.
    expect((env as Record<string, unknown>).tenantId).toBe(tenantId);
  });

  it('coerces metadata: null to omitted (Zod .optional() rejects null)', () => {
    const env = dbRowToEnvelope({ ...baseRow, metadata: null }, tenantId);
    expect(env.metadata).toBeUndefined();
    expect('metadata' in env).toBe(false);
  });

  it('passes metadata through unchanged when present', () => {
    const env = dbRowToEnvelope(
      { ...baseRow, metadata: { durationMs: 123 } },
      tenantId,
    );
    expect(env.metadata).toEqual({ durationMs: 123 });
  });

  it('produces a value that satisfies HubEventEnvelope Zod validation', () => {
    const env = dbRowToEnvelope(baseRow, tenantId);
    expect(() => HubEventEnvelope.parse(env)).not.toThrow();
  });

  it('does NOT include the DB row id (envelope uses sequenceNumber)', () => {
    const env = dbRowToEnvelope(baseRow, tenantId);
    expect((env as Record<string, unknown>).id).toBeUndefined();
    expect(env.sequenceNumber).toBe(7);
  });
});
