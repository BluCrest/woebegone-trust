import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function rateLimitMiddleware(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: 60,
    }),
  });
}
