import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { services } from './services.js';

export const dataPoints = sqliteTable('data_points', {
  id: text('id').primaryKey(),
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),

  category: text('category').notNull(),
  source: text('source').notNull(),
  sourceUrl: text('source_url'),

  data: text('data').notNull(),
  confidence: real('confidence').notNull().default(0.5),

  collectedAt: integer('collected_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),

  rawEvidence: text('raw_evidence'),
});
