import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const shared = pgSchema('shared');

export const tenants = shared.table('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  vaultPath: text('vault_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
