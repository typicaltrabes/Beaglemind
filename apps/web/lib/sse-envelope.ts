import type { HubEventEnvelope } from '@beagle-console/shared';

/**
 * Shape a tenant `events` table row (as returned by Drizzle) into a
 * `HubEventEnvelope` ready for SSE serialization.
 *
 * Bug fix (UAT-14-01): the SSE replay path previously emitted `JSON.stringify(row)`
 * directly. The DB row has `createdAt` (JS Date) but no `timestamp` field, so the
 * client's `formatRelativeTime(event.timestamp)` got undefined and rendered `NaN:NaN`.
 * This helper does the createdAt → timestamp mapping in one place, mirroring the
 * canonical serialization in apps/agent-hub/src/events/event-store.ts:29.
 *
 * NOTE: the events table has no `tenantId` column (it's implied by the schema),
 * so the caller passes it in from the outer SSE handler scope.
 */
export interface EventDbRow {
  id: number;                              // serial primary key, NOT included in envelope
  runId: string;
  sequenceNumber: number;
  type: string;                            // broader than MessageType at runtime; trust the DB
  agentId: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export function dbRowToEnvelope(
  row: EventDbRow,
  tenantId: string,
): HubEventEnvelope {
  return {
    type: row.type as HubEventEnvelope['type'],
    agentId: row.agentId,
    runId: row.runId,
    tenantId,
    sequenceNumber: row.sequenceNumber,
    content: row.content,
    // Coerce null → undefined: the DB column is NULLABLE jsonb but the Zod
    // contract uses `.optional()` which rejects null. Drop the key entirely
    // when null so spread/serialize behavior is identical.
    ...(row.metadata != null ? { metadata: row.metadata } : {}),
    // THE FIX: createdAt is a JS Date when Drizzle reads `timestamp with time zone`.
    // toISOString() matches the format produced by EventStore.persist (event-store.ts:29).
    timestamp: row.createdAt.toISOString(),
  };
}
