import { pgSchema, uuid, text, varchar, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export function createTenantSchema(tenantId: string) {
  // Sanitize tenant ID: replace hyphens with underscores for valid Postgres schema names
  const safeId = tenantId.replace(/-/g, '_');
  const schema = pgSchema(`tenant_${safeId}`);

  // --- Projects (D-01) ---
  const projects = schema.table('projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // --- Runs (D-02, updated from Phase 1; title re-added in Phase 13) ---
  const runs = schema.table('runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    kind: text('kind').notNull().default('research_sprint'),
    parentRunId: uuid('parent_run_id'),
    status: text('status').notNull().default('pending'),
    prompt: text('prompt'),
    title: varchar('title', { length: 80 }),
    createdBy: text('created_by').notNull(),
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
    extractedText: text('extracted_text'), // Phase 17: nullable — NULL for images and extraction failures
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

  // --- Share Links (Phase 8 D-02) ---
  const shareLinks = schema.table('share_links', {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').notNull().references(() => runs.id),
    token: text('token').notNull(),
    createdBy: text('created_by').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }, (t) => [
    uniqueIndex('share_links_token_idx').on(t.token),
  ]);

  // --- Replay Views (Phase 8 D-10) ---
  const replayViews = schema.table('replay_views', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    shareLinkId: uuid('share_link_id').notNull().references(() => shareLinks.id),
    viewerIp: text('viewer_ip').notNull(),
    userAgent: text('user_agent'),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull(),
  });

  // --- Break-Glass Audit (Phase 9 D-09, D-10) ---
  const breakGlassAudit = schema.table('break_glass_audit', {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: text('operator_id').notNull(),
    operatorEmail: text('operator_email').notNull(),
    reason: text('reason').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  });

  return { schema, runs, messages, events, projects, plans, questions, artifacts, stateTransitions, shareLinks, replayViews, breakGlassAudit };
}
