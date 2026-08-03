import { pgTable, text, timestamp, jsonb, integer, index, primaryKey } from 'drizzle-orm/pg-core';
import { services } from './services.js';

export const verificationCredentials = pgTable(
  'verification_credentials',
  {
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),

    tier: text('tier').notNull(), // 'bronze' | 'silver' | 'gold' | 'platinum'
    trustScore: integer('trust_score').notNull(),
    verifiedFactors: text('verified_factors').array().notNull().default([]),

    // On-chain credential
    credentialId: text('credential_id'), // tx hash or credential identifier
    chainId: integer('chain_id'), // Ethereum mainnet = 1
    contractAddress: text('contract_address'),

    // Metadata
    metadataUri: text('metadata_uri'), // IPFS/Arweave link
    methodologyVersion: text('methodology_version').notNull(),

    // Timestamps
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revocationReason: text('revocation_reason'),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId] }),
    index('verification_tier_idx').on(t.tier),
    index('verification_expires_idx').on(t.expiresAt),
  ]
);

export const verificationRequests = pgTable(
  'verification_requests',
  {
    id: text('id').primaryKey(),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),

    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'expired'
    requestedTier: text('requested_tier').notNull(),

    // Evidence submitted
    evidence: jsonb('evidence').$type<{
      auditReports?: string[];
      proofOfReserves?: string;
      teamPage?: string;
      github?: string;
      insurance?: string;
      regulatory?: string;
      other?: string[];
    }>(),

    // Review
    reviewerNotes: text('reviewer_notes'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('verification_requests_service_idx').on(t.serviceId),
    index('verification_requests_status_idx').on(t.status),
  ]
);
