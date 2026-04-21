import { pgSchema, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const shared = pgSchema('shared');

export const tenants = shared.table('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  vaultPath: text('vault_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// D-07: Push notification subscriptions stored in shared schema
// userId references shared.users(id) -- no FK import to avoid circular dependency with auth-schema
export const pushSubscriptions = shared.table('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  keysP256dh: text('keys_p256dh').notNull(),
  keysAuth: text('keys_auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('push_sub_user_endpoint_idx').on(t.userId, t.endpoint),
]);
