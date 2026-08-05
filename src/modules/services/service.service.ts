import { eq, and, desc, asc, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { services, type ServiceCategory } from '../../db/schema/services.js';
import { serviceScores, scoreHistory } from '../../db/schema/scores.js';
import { dataPoints } from '../../db/schema/data-points.js';
import { collectServiceData } from '../data-collection/aggregator.js';
import { calculateTrustScore } from '../scoring/scoring.engine.js';

export interface ListOptions {
  cursor?: string;
  limit: number;
  category?: ServiceCategory;
  minScore?: number;
  maxScore?: number;
  grade?: string;
  sort: string;
  order: 'asc' | 'desc';
  search?: string;
}

export async function listServices(options: ListOptions) {
  const db = getDb();
  const conditions: SQL[] = [eq(services.isActive, true)];

  if (options.category) {
    conditions.push(eq(services.category, options.category));
  }
  if (options.search) {
    const term = `%${options.search}%`;
    conditions.push(
      sql`(${services.name} LIKE ${term} OR ${services.slug} LIKE ${term} OR ${services.description} LIKE ${term} OR ${services.tags} LIKE ${term})`
    );
  }
  if (options.minScore !== undefined) {
    conditions.push(sql`${serviceScores.overallScore} >= ${options.minScore}`);
  }
  if (options.maxScore !== undefined) {
    conditions.push(sql`${serviceScores.overallScore} <= ${options.maxScore}`);
  }
  if (options.grade) {
    conditions.push(eq(serviceScores.grade, options.grade));
  }

  let query = db
    .select({
      id: services.id,
      name: services.name,
      slug: services.slug,
      category: services.category,
      website: services.website,
      logoUrl: services.logoUrl,
      createdAt: services.createdAt,
      overallScore: serviceScores.overallScore,
      grade: serviceScores.grade,
      confidence: serviceScores.confidence,
    })
    .from(services)
    .leftJoin(serviceScores, eq(services.id, serviceScores.serviceId))
    .where(and(...conditions))
    .orderBy(
      options.order === 'desc'
        ? desc(options.sort === 'score' ? serviceScores.overallScore : services.createdAt)
        : asc(options.sort === 'score' ? serviceScores.overallScore : services.createdAt)
    )
    .limit(options.limit + 1);

  const results = await query;
  const hasMore = results.length > options.limit;
  const items = hasMore ? results.slice(0, options.limit) : results;

  return {
    data: items,
    pagination: {
      cursor: hasMore ? Buffer.from(JSON.stringify({ id: items[items.length - 1]?.id })).toString('base64') : null,
      hasMore,
    },
  };
}

export async function getServiceById(id: string) {
  const db = getDb();

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, id))
    .limit(1);

  if (!service) return null;

  const [score] = await db
    .select()
    .from(serviceScores)
    .where(eq(serviceScores.serviceId, id))
    .limit(1);

  return { ...service, score: score || null };
}

export async function getServiceBySlug(slug: string) {
  const db = getDb();

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.slug, slug))
    .limit(1);

  if (!service) return null;

  const [score] = await db
    .select()
    .from(serviceScores)
    .where(eq(serviceScores.serviceId, service.id))
    .limit(1);

  return { ...service, score: score || null };
}

export async function getServiceScoreHistory(serviceId: string, limit = 30) {
  const db = getDb();

  return db
    .select()
    .from(scoreHistory)
    .where(eq(scoreHistory.serviceId, serviceId))
    .orderBy(desc(scoreHistory.calculatedAt))
    .limit(limit);
}

export async function getServiceDataPoints(serviceId: string, category?: string) {
  const db = getDb();
  const conditions = [eq(dataPoints.serviceId, serviceId)];
  if (category) {
    conditions.push(eq(dataPoints.category, category));
  }

  return db
    .select()
    .from(dataPoints)
    .where(and(...conditions))
    .orderBy(desc(dataPoints.collectedAt));
}

export async function createService(data: {
  id: string;
  name: string;
  slug: string;
  category: ServiceCategory;
  website?: string;
  description?: string;
  logoUrl?: string;
  foundedYear?: number;
  headquarters?: string;
  legalEntity?: string;
  submitterEmail?: string;
  submitterRelation?: string;
  addresses?: Record<string, string[]>;
  tags?: string[];
}) {
  const db = getDb();

  const [result] = await db
    .insert(services)
    .values({
      id: data.id,
      name: data.name,
      slug: data.slug,
      category: data.category,
      website: data.website || null,
      description: data.description || null,
      logoUrl: data.logoUrl || null,
      foundedYear: data.foundedYear || null,
      headquarters: data.headquarters || null,
      legalEntity: data.legalEntity || null,
      submitterEmail: data.submitterEmail || null,
      submitterRelation: data.submitterRelation || null,
      addresses: JSON.stringify(data.addresses || {}),
      tags: JSON.stringify(data.tags || []),
      isActive: true,
      isUnderReview: false,
    })
    .returning();

  return result;
}

export async function updateServiceScore(
  serviceId: string,
  score: {
    overallScore: number;
    grade: string;
    confidence: number;
    factorBreakdown: Record<string, { score: number; confidence: number; weight: number }>;
    methodologyVersion: string;
  }
) {
  const db = getDb();

  await db
    .insert(serviceScores)
    .values({
      serviceId,
      overallScore: score.overallScore,
      grade: score.grade,
      confidence: score.confidence,
      methodologyVersion: score.methodologyVersion,
      calculatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: serviceScores.serviceId,
      set: {
        overallScore: score.overallScore,
        grade: score.grade,
        confidence: score.confidence,
        methodologyVersion: score.methodologyVersion,
        calculatedAt: new Date(),
      },
    });

  const historyId = `${serviceId}-${Date.now()}`;
  await db.insert(scoreHistory).values({
    id: historyId,
    serviceId,
    overallScore: score.overallScore,
    grade: score.grade,
    confidence: score.confidence,
    factorBreakdown: JSON.stringify(score.factorBreakdown),
    methodologyVersion: score.methodologyVersion,
  });
}

export async function getLeaderboard(options: {
  category?: ServiceCategory;
  limit: number;
  offset?: number;
}) {
  const db = getDb();
  const conditions = [eq(services.isActive, true)];

  if (options.category) {
    conditions.push(eq(services.category, options.category));
  }

  return db
    .select({
      id: services.id,
      name: services.name,
      slug: services.slug,
      category: services.category,
      logoUrl: services.logoUrl,
      website: services.website,
      overallScore: serviceScores.overallScore,
      grade: serviceScores.grade,
      confidence: serviceScores.confidence,
    })
    .from(services)
    .leftJoin(serviceScores, eq(services.id, serviceScores.serviceId))
    .where(and(...conditions))
    .orderBy(
      sql`COALESCE(${serviceScores.overallScore}, 0) DESC, ${services.name} ASC`
    )
    .limit(options.limit)
    .offset(options.offset || 0);
}

/**
 * Run the full scoring pipeline for a single service:
 * collect data → calculate score → write to database
 */
export async function scoreService(serviceId: string) {
  const db = getDb();
  const service = await getServiceById(serviceId);
  if (!service) return null;

  const { factorData, rawData } = await collectServiceData({
    id: service.id,
    name: service.name,
    website: service.website || undefined,
    addresses: typeof service.addresses === 'string' ? JSON.parse(service.addresses) : service.addresses || {},
  });

  // Store raw data points
  for (const point of rawData) {
    await db.insert(dataPoints).values({
      id: `${serviceId}-${point.source}-${point.dataType}-${Date.now()}`,
      serviceId,
      category: point.dataType,
      source: point.source,
      data: JSON.stringify(point.data),
      confidence: point.confidence,
    });
  }

  // Calculate trust score
  const score = await calculateTrustScore(serviceId, factorData);

  // Write score to database
  await updateServiceScore(serviceId, {
    overallScore: score.score,
    grade: score.grade,
    confidence: score.confidence,
    factorBreakdown: Object.fromEntries(
      Object.entries(score.factors).map(([k, v]) => [k, { score: v.score, confidence: v.confidence, weight: v.weight }])
    ),
    methodologyVersion: score.methodologyVersion,
  });

  return score;
}

/**
 * Score all active services
 */
export async function scoreAllServices() {
  const db = getDb();
  const allServices = await db.select().from(services).where(eq(services.isActive, true));

  const results = [];
  for (const service of allServices) {
    try {
      const score = await scoreService(service.id);
      results.push({ serviceId: service.id, success: true, score: score?.score, grade: score?.grade });
    } catch (err) {
      results.push({ serviceId: service.id, success: false, error: String(err) });
    }
  }

  return results;
}
