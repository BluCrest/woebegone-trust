import { pgTable, text, timestamp, jsonb, real, index } from 'drizzle-orm/pg-core';
import { services } from './services.js';

export const dataPoints = pgTable(
  'data_points',
  {
    id: text('id').primaryKey(),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),

    // What data this is
    category: text('category').notNull(), // 'security_audit', 'proof_of_reserves', 'team', 'insurance', etc.
    source: text('source').notNull(), // 'etherscan', 'coingecko', 'manual', 'web_scrape', etc.
    sourceUrl: text('source_url'),

    // The actual data
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    confidence: real('confidence').notNull().default(0.5),

    // Freshness
    collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Raw evidence
    rawEvidence: jsonb('raw_evidence').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('data_points_service_idx').on(t.serviceId),
    index('data_points_category_idx').on(t.category),
    index('data_points_source_idx').on(t.source),
  ]
);
