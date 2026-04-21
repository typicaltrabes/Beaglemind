import { pgSchema, uuid, text, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export function createTenantSchema(tenantId: string) {
  const schema = pgSchema(`tenant_${tenantId}`);

  const runs = schema.table('runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title'),
    status: text('status').notNull().default('pending'),
    prompt: text('prompt'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });

  const messages = schema.table('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull(),
    agentName: text('agent_name'),
    content: text('content').notNull(),
    sequence: integer('sequence').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  const events = schema.table('events', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    sequenceNumber: integer('sequence_number').notNull(),
    type: text('type').notNull(),
    agentId: text('agent_id').notNull(),
    content: jsonb('content').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }, (t) => [
    uniqueIndex('events_run_seq_idx').on(t.runId, t.sequenceNumber),
  ]);

  return { schema, runs, messages, events };
}
