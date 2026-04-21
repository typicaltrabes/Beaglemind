import { pgSchema, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

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

  return { schema, runs, messages };
}
