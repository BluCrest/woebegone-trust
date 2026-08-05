import type { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import {
  listServices,
  getServiceById,
  getServiceScoreHistory,
  getServiceDataPoints,
  getLeaderboard,
  scoreService,
  scoreAllServices,
  createService,
} from './service.service.js';
import {
  listServicesQuerySchema,
  serviceIdParamSchema,
  submitServiceSchema,
} from './service.types.js';

function etag(data: unknown): string {
  return createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}

export async function serviceRoutes(app: FastifyInstance) {
  // GET /v1/services — list all services
  app.get('/v1/services', async (request, reply) => {
    const query = listServicesQuerySchema.parse(request.query);
    const result = await listServices(query);

    const response = {
      data: result.data,
      pagination: result.pagination,
      meta: { total: result.data.length, methodologyVersion: '1.0.0' },
    };

    const tag = etag(response);
    reply.header('ETag', `"${tag}"`);
    reply.header('Cache-Control', 'public, max-age=60');

    if (request.headers['if-none-match'] === `"${tag}"`) {
      return reply.code(304).send();
    }

    return reply.send(response);
  });

  // GET /v1/services/leaderboard — top scored services
  app.get('/v1/services/leaderboard', async (request, reply) => {
    const { category, limit } = request.query as {
      category?: string;
      limit?: number;
    };

    const results = await getLeaderboard({
      category: category as any,
      limit: Math.min(limit || 20, 100),
    });

    const response = { data: results };
    const tag = etag(response);
    reply.header('ETag', `"${tag}"`);
    reply.header('Cache-Control', 'public, max-age=120');

    if (request.headers['if-none-match'] === `"${tag}"`) {
      return reply.code(304).send();
    }

    return reply.send(response);
  });

  // POST /v1/services/:id/score — run scoring pipeline for one service
  app.post('/v1/services/:id/score', async (request, reply) => {
    const { id } = serviceIdParamSchema.parse(request.params);
    const service = await getServiceById(id);

    if (!service) {
      return reply.code(404).send({ error: 'Service not found' });
    }

    const result = await scoreService(id);

    if (!result) {
      return reply.code(500).send({ error: 'Scoring failed' });
    }

    return reply.send({
      data: {
        serviceId: id,
        score: result.score,
        grade: result.grade,
        confidence: result.confidence,
        dataCoverage: result.dataCoverage,
        factors: result.factors,
      },
    });
  });

  // POST /v1/services/score-all — score all services
  app.post('/v1/services/score-all', async (_request, reply) => {
    const results = await scoreAllServices();
    return reply.send({ data: results });
  });

  // GET /v1/services/:id — specific service with full score breakdown
  app.get('/v1/services/:id', async (request, reply) => {
    const { id } = serviceIdParamSchema.parse(request.params);
    const service = await getServiceById(id);

    if (!service) {
      return reply.code(404).send({ error: 'Service not found' });
    }

    const response = { data: service };
    const tag = etag(response);
    reply.header('ETag', `"${tag}"`);
    reply.header('Cache-Control', 'public, max-age=30');

    if (request.headers['if-none-match'] === `"${tag}"`) {
      return reply.code(304).send();
    }

    return reply.send(response);
  });

  // GET /v1/services/:id/history — score history
  app.get('/v1/services/:id/history', async (request, reply) => {
    const { id } = serviceIdParamSchema.parse(request.params);
    const service = await getServiceById(id);

    if (!service) {
      return reply.code(404).send({ error: 'Service not found' });
    }

    const { limit } = request.query as { limit?: number };
    const history = await getServiceScoreHistory(id, Math.min(limit || 30, 100));
    return reply.send({ data: history });
  });

  // GET /v1/services/:id/data — data points
  app.get('/v1/services/:id/data', async (request, reply) => {
    const { id } = serviceIdParamSchema.parse(request.params);
    const service = await getServiceById(id);

    if (!service) {
      return reply.code(404).send({ error: 'Service not found' });
    }

    const { category } = request.query as { category?: string };
    const dataPoints = await getServiceDataPoints(id, category);
    return reply.send({ data: dataPoints });
  });

  // POST /v1/services — self-submit a service for scoring
  app.post('/v1/services', async (request, reply) => {
    const body = submitServiceSchema.parse(request.body);

    // Generate slug from name
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    try {
      const service = await createService({
        id: slug,
        name: body.name,
        slug,
        category: body.category,
        website: body.website,
        description: body.description,
        logoUrl: body.logoUrl,
        foundedYear: body.foundedYear,
        headquarters: body.headquarters,
        legalEntity: body.legalEntity,
        submitterEmail: body.contactEmail,
        addresses: body.addresses || {},
        tags: body.tags || [],
      });

      return reply.code(201).send({
        data: service,
        message: 'Service submitted. Scores will be calculated on next data refresh.',
      });
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return reply.code(409).send({ error: 'A service with this name already exists' });
      }
      throw err;
    }
  });

  // GET /v1/services/search — search services
  app.get('/v1/services/search', async (request, reply) => {
    const { q, category, minScore, maxScore, grade } = request.query as {
      q?: string;
      category?: string;
      minScore?: number;
      maxScore?: number;
      grade?: string;
    };

    if (!q || q.length < 2) {
      return reply.code(400).send({ error: 'Search query must be at least 2 characters' });
    }

    const result = await listServices({
      search: q,
      category: category as any,
      minScore,
      maxScore,
      grade,
      limit: 20,
      sort: 'score',
      order: 'desc',
    });

    return reply.send({ data: result.data, meta: { total: result.data.length } });
  });
}
