import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { services } from './services.js';

export const serviceScores = sqliteTable('service_scores', {
  serviceId: text('service_id')
    .primaryKey()
    .references(() => services.id, { onDelete: 'cascade' }),

  overallScore: integer('overall_score').notNull().default(0),
  grade: text('grade').notNull(),
  confidence: real('confidence').notNull().default(0),

  securityAudits: integer('security_audits'),
  proofOfReserves: integer('proof_of_reserves'),
  trackRecord: integer('track_record'),
  teamTransparency: integer('team_transparency'),
  insurance: integer('insurance'),
  regulatoryCompliance: integer('regulatory_compliance'),
  openSource: integer('open_source'),
  incidentHistory: integer('incident_history'),

  factorConfidence: text('factor_confidence').default('{}'),
  methodologyVersion: text('methodology_version').notNull().default('1.0.0'),

  calculatedAt: integer('calculated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});

export const scoreHistory = sqliteTable('score_history', {
  id: text('id').primaryKey(),
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  overallScore: integer('overall_score').notNull(),
  grade: text('grade').notNull(),
  confidence: real('confidence').notNull(),
  factorBreakdown: text('factor_breakdown'),
  methodologyVersion: text('methodology_version').notNull(),
  calculatedAt: integer('calculated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
