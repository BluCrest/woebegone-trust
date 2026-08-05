import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { resolve } from 'path';
import { getConfig } from './config/index.js';
import { registerRoutes } from './api/routes/v1/index.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { rateLimitMiddleware } from './api/middleware/rate-limit.js';

export async function buildApp() {
  const config = getConfig();

  const app = Fastify({
    logger: config.NODE_ENV !== 'production',
    trustProxy: true,
  });

  // Swagger/OpenAPI documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Point Woebegone Trust Registry',
        description: 'Open-source crypto trust scoring and verification platform. No black boxes. No accounts for reading. A public good.',
        version: '0.1.0',
        contact: { name: 'Point Woebegone', url: 'https://pointwoebegone.com' },
        license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development' },
      ],
      components: {
        securitySchemes: {},
      },
      tags: [
        { name: 'Services', description: 'Crypto service scoring and listing' },
        { name: 'Verification', description: 'Woebegone Verified certification' },
        { name: 'Methodology', description: 'Scoring methodology (public)' },
        { name: 'Health', description: 'Health checks' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // CORS
  await app.register(cors, {
    origin: true, // public API — allow all origins
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Rate limiting
  await rateLimitMiddleware(app);

  // Error handler
  await errorHandler(app);

  // Static files (frontend)
  await app.register(fastifyStatic, {
    root: resolve(import.meta.dirname, '../public'),
    prefix: '/',
    decorateReply: false,
  });

  // API routes
  await registerRoutes(app);

  // SPA fallback — serve index.html for non-API routes
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/v1') || request.url.startsWith('/health')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  return app;
}
