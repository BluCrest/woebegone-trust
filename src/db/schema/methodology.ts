import { pgTable, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';

export const methodologies = pgTable(
  'methodologies',
  {
    version: text('version').primaryKey(), // semver: '1.0.0'
    factors: jsonb('factors')
      .$type<
        Array<{
          id: string;
          name: string;
          weight: number;
          description: string;
          subFactors: Array<{ id: string; name: string; maxPoints: number }>;
        }>
      >()
      .notNull(),
    thresholds: jsonb('thresholds')
      .$type<{
        platinum: number;
        gold: number;
        silver: number;
        bronze: number;
        insufficientData: number;
      }>()
      .notNull(),
    changelog: text('changelog').notNull(),
    isActive: integer('is_active').notNull().default(1), // 1 = active, 0 = superseded
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('methodologies_active_idx').on(t.isActive),
  ]
);
