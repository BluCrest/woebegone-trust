import { eq, and, desc, asc, like, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { services, type ServiceCategory } from '../../db/schema/services.js';
import { serviceScores, scoreHistory } from '../../db/schema/scores.js';
import { dataPoints } from '../../db/schema/data-points.js';

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
    conditions.push(like(services.name, `%${options.search}%`));
  }

  // Build the query with optional score filters via LEFT JOIN
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
    .limit(options.limit + 1); // fetch one extra to detect hasMore

  if (options.minScore !== undefined) {
    conditions.push(sql`${serviceScores.overallScore} >= ${options.minScore}`);
  }
  if (options.maxScore !== undefined) {
    conditions.push(sql`${serviceScores.overallScore} <= ${options.maxScore}`);
  }
  if (options.grade) {
    conditions.push(eq(serviceScores.grade, options.grade));
  }

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
      ...data,
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

  // Upsert current score
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

  // Add to history
  const historyId = `${serviceId}-${Date.now()}`;
  await db.insert(scoreHistory).values({
    id: historyId,
    serviceId,
    overallScore: score.overallScore,
    grade: score.grade,
    confidence: score.confidence,
    factorBreakdown: score.factorBreakdown,
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
      overallScore: serviceScores.overallScore,
      grade: serviceScores.grade,
    })
    .from(services)
    .innerJoin(serviceScores, eq(services.id, serviceScores.serviceId))
    .where(and(...conditions))
    .orderBy(desc(serviceScores.overallScore))
    .limit(options.limit)
    .offset(options.offset || 0);
}
