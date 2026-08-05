import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { services } from './services.js';

export const verificationCredentials = sqliteTable('verification_credentials', {
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),

  tier: text('tier').notNull(),
  trustScore: integer('trust_score').notNull(),
  verifiedFactors: text('verified_factors').default('[]'),

  credentialId: text('credential_id'),
  chainId: integer('chain_id'),
  contractAddress: text('contract_address'),

  metadataUri: text('metadata_uri'),
  methodologyVersion: text('methodology_version').notNull(),

  issuedAt: integer('issued_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  revocationReason: text('revocation_reason'),
});

export const verificationRequests = sqliteTable('verification_requests', {
  id: text('id').primaryKey(),
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),

  status: text('status').notNull().default('pending'),
  requestedTier: text('requested_tier').notNull(),

  evidence: text('evidence'),

  reviewerNotes: text('reviewer_notes'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
