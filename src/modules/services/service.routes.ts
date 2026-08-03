import type { FastifyInstance } from 'fastify';
import {
  listServices,
  getServiceById,
  getServiceScoreHistory,
  getServiceDataPoints,
  getLeaderboard,
} from './service.service.js';
import {
  listServicesQuerySchema,
  serviceIdParamSchema,
} from './service.types.js';

export async function serviceRoutes(app: FastifyInstance) {
  // GET /v1/services — list all scored services
  app.get('/v1/services', async (request, reply) => {
    const query = listServicesQuerySchema.parse(request.query);
    const result = await listServices(query);

    return reply.send({
      data: result.data,
      pagination: result.pagination,
      meta: { total: result.data.length, methodologyVersion: '1.0.0' },
    });
  });

  // GET /v1/services/leaderboard — top scored services
  app.get('/v1/services/leaderboard', async (request, reply) => {
    const query = listServicesQuerySchema.parse(request.query);
    const results = await getLeaderboard({
      category: query.category,
      limit: query.limit,
    });

    return reply.send({ data: results });
  });

  // GET /v1/services/:id — specific service with full score breakdown
  app.get('/v1/services/:id', async (request, reply) => {
    const { id } = serviceIdParamSchema.parse(request.params);
    const service = await getServiceById(id);

    if (!service) {
      return reply.code(404).send({ error: 'Service not found' });
    }

    return reply.send({ data: service });
  });

  // GET /v1/services/:id/history — score history
  app.get('/v1/services/:id/history', async (request, reply) => {
    const { id } = serviceIdParamSchema.parse(request.params);
    const service = await getServiceById(id);

    if (!service) {
      return reply.code(404).send({ error: 'Service not found' });
    }

    const history = await getServiceScoreHistory(id);
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
}
