import type { FastifyInstance } from 'fastify';
import { DEFAULT_METHODOLOGY } from '../../../modules/scoring/methodology.js';

export async function methodologyRoutes(app: FastifyInstance) {
  // GET /v1/methodology — current scoring methodology
  app.get('/v1/methodology', async (_request, reply) => {
    return reply.send({ data: DEFAULT_METHODOLOGY });
  });

  // GET /v1/methodology/versions — list all versions
  app.get('/v1/methodology/versions', async (_request, reply) => {
    // For MVP, only one version exists
    return reply.send({
      data: [
        {
          version: DEFAULT_METHODOLOGY.version,
          changelog: DEFAULT_METHODOLOGY.changelog,
          isActive: true,
          createdAt: '2026-08-03T00:00:00Z',
        },
      ],
    });
  });
}
