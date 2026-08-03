import { pgTable, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const serviceCategories = [
  'exchange',
  'wallet',
  'defi',
  'bridge',
  'custodian',
  'hardware_wallet',
  'mixer',
  'payment',
  'lending',
  'staking',
  'nft_marketplace',
  'other',
] as const;

export type ServiceCategory = (typeof serviceCategories)[number];

export const services = pgTable(
  'services',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    category: text('category', { enum: serviceCategories }).notNull(),
    website: text('website'),
    description: text('description'),
    logoUrl: text('logo_url'),

    // Core identity
    foundedYear: integer('founded_year'),
    headquarters: text('headquarters'),
    legalEntity: text('legal_entity'),

    // Ownership info
    submitterEmail: text('submitter_email'),
    submitterRelation: text('submitter_relation'), // 'owner', 'community', 'unknown'

    // On-chain addresses (for data collection)
    addresses: jsonb('addresses').$type<Record<string, string[]>>().default({}),
    // e.g. { ethereum: ["0x..."], solana: ["..."] }

    // Metadata
    tags: text('tags').array().default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    // Status
    isActive: boolean('is_active').default(true),
    isUnderReview: boolean('is_under_review').default(false),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('services_category_idx').on(t.category),
    index('services_slug_idx').on(t.slug),
    index('services_is_active_idx').on(t.isActive),
  ]
);
