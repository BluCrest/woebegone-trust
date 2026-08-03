import type { FastifyInstance } from 'fastify';
import { serviceCategories } from '../../../db/schema/services.js';

export async function categoriesRoutes(app: FastifyInstance) {
  // GET /v1/categories — list service categories
  app.get('/v1/categories', async (_request, reply) => {
    const categories = serviceCategories.map((cat) => ({
      id: cat,
      name: cat
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
    }));

    return reply.send({ data: categories });
  });
}
