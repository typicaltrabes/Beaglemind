import { pgSchema, uuid, text, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export function createTenantSchema(tenantId: string) {
  const schema = pgSchema(`tenant_${tenantId}`);

  // --- Projects (D-01) ---
  const projects = schema.table('projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // --- Runs (D-02, updated from Phase 1) ---
  const runs = schema.table('runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    kind: text('kind').notNull().default('research_sprint'),
    parentRunId: uuid('parent_run_id'),
    status: text('status').notNull().default('pending'),
    prompt: text('prompt'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // --- Messages (Phase 1, unchanged) ---
  const messages = schema.table('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull(),
    agentName: text('agent_name'),
    content: text('content').notNull(),
    sequence: integer('sequence').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // --- Events (Phase 3, unchanged) ---
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

  // --- Plans (D-03) ---
  const plans = schema.table('plans', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    content: jsonb('content').notNull(),
    costEstimate: jsonb('cost_estimate'),
    durationEstimate: text('duration_estimate'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by'),
  });

  // --- Questions (D-04) ---
  const questions = schema.table('questions', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    agentId: text('agent_id').notNull(),
    content: text('content').notNull(),
    answer: text('answer'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    answeredBy: uuid('answered_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // --- Artifacts (D-05) ---
  const artifacts = schema.table('artifacts', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    minioKey: text('minio_key').notNull(),
    agentId: text('agent_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // --- State Transitions (D-06) ---
  const stateTransitions = schema.table('state_transitions', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    triggeredBy: text('triggered_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  return { schema, runs, messages, events, projects, plans, questions, artifacts, stateTransitions };
}
