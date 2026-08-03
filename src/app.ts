import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
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
