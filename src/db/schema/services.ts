import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  category: text('category').notNull(),
  website: text('website'),
  description: text('description'),
  logoUrl: text('logo_url'),

  foundedYear: integer('founded_year'),
  headquarters: text('headquarters'),
  legalEntity: text('legal_entity'),

  submitterEmail: text('submitter_email'),
  submitterRelation: text('submitter_relation'),

  addresses: text('addresses').default('{}'),
  tags: text('tags').default('[]'),
  metadata: text('metadata').default('{}'),

  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isUnderReview: integer('is_under_review', { mode: 'boolean' }).default(false),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
