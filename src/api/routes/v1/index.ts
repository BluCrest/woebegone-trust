import type { FastifyInstance } from 'fastify';
import { serviceRoutes } from '../../../modules/services/service.routes.js';
import { verificationRoutes } from '../../../modules/verification/verification.routes.js';
import { methodologyRoutes } from './methodology.js';
import { categoriesRoutes } from './categories.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // API info
  app.get('/v1', async () => ({
    name: 'Point Woebegone Trust Registry',
    version: '0.1.0',
    description: 'Open-source crypto trust scoring and verification platform',
    documentation: '/docs',
    endpoints: {
      services: '/v1/services',
      leaderboard: '/v1/services/leaderboard',
      methodology: '/v1/methodology',
      categories: '/v1/categories',
      verification: '/v1/verification',
    },
  }));

  // Register route groups
  await app.register(serviceRoutes);
  await app.register(verificationRoutes);
  await app.register(methodologyRoutes);
  await app.register(categoriesRoutes);
}
