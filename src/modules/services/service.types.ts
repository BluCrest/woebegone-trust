import { z } from 'zod';
import { serviceCategories } from '../../db/schema/services.js';

export const serviceIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listServicesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.enum(serviceCategories).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  grade: z.enum(['platinum', 'gold', 'silver', 'bronze', 'unscored']).optional(),
  sort: z.enum(['score', 'name', 'created', 'updated']).default('score'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export const submitServiceSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(serviceCategories),
  website: z.string().url().optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  foundedYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  headquarters: z.string().max(200).optional(),
  legalEntity: z.string().max(200).optional(),
  contactEmail: z.string().email(),
  addresses: z.record(z.array(z.string())).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const submitEvidenceSchema = z.object({
  auditReports: z.array(z.string().url()).optional(),
  proofOfReserves: z.string().url().optional(),
  teamPage: z.string().url().optional(),
  github: z.string().url().optional(),
  insurance: z.string().url().optional(),
  regulatory: z.string().url().optional(),
  other: z.array(z.string().url()).optional(),
});
