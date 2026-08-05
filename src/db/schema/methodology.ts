import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const methodologies = sqliteTable('methodologies', {
  version: text('version').primaryKey(),
  factors: text('factors').notNull(),
  thresholds: text('thresholds').notNull(),
  changelog: text('changelog').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
