import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, request: FastifyRequest, reply: FastifyReply) => {
    const logger = request.log;

    // Zod validation errors
    if (error.validation) {
      logger.warn({ err: error }, 'Validation error');
      return reply.code(400).send({
        error: 'Validation error',
        details: error.message,
      });
    }

    // Custom HTTP errors
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        error: error.message,
      });
    }

    // Unexpected errors
    logger.error({ err: error }, 'Unexpected error');
    return reply.code(500).send({
      error: 'Internal server error',
    });
  });
}
