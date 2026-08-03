import { pgTable, text, timestamp, integer, jsonb, real, index, primaryKey } from 'drizzle-orm/pg-core';
import { services } from './services.js';

export const serviceScores = pgTable(
  'service_scores',
  {
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),

    // Overall score
    overallScore: integer('overall_score').notNull().default(0),
    grade: text('grade').notNull(), // 'platinum' | 'gold' | 'silver' | 'bronze' | 'unscored'
    confidence: real('confidence').notNull().default(0),

    // Factor breakdown (individual 0-100 scores)
    securityAudits: integer('security_audits'),
    proofOfReserves: integer('proof_of_reserves'),
    trackRecord: integer('track_record'),
    teamTransparency: integer('team_transparency'),
    insurance: integer('insurance'),
    regulatoryCompliance: integer('regulatory_compliance'),
    openSource: integer('open_source'),
    incidentHistory: integer('incident_history'),

    // Factor confidence (how much data we had)
    factorConfidence: jsonb('factor_confidence').$type<Record<string, number>>().default({}),

    // Methodology version used
    methodologyVersion: text('methodology_version').notNull().default('1.0.0'),

    // Timestamps
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId] }),
    index('service_scores_overall_idx').on(t.overallScore),
    index('service_scores_grade_idx').on(t.grade),
  ]
);

export const scoreHistory = pgTable(
  'score_history',
  {
    id: text('id').primaryKey(),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    overallScore: integer('overall_score').notNull(),
    grade: text('grade').notNull(),
    confidence: real('confidence').notNull(),
    factorBreakdown: jsonb('factor_breakdown').$type<Record<string, { score: number; confidence: number; weight: number }>>(),
    methodologyVersion: text('methodology_version').notNull(),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('score_history_service_idx').on(t.serviceId),
    index('score_history_date_idx').on(t.calculatedAt),
  ]
);
