import type { FastifyInstance } from 'fastify';
import { getDb } from '../../config/database.js';
import { verificationCredentials, verificationRequests } from '../../db/schema/verifications.js';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function verificationRoutes(app: FastifyInstance) {
  // POST /v1/verification/request — request verification
  app.post('/v1/verification/request', async (request, reply) => {
    const { serviceId, requestedTier, evidence } = request.body as {
      serviceId: string;
      requestedTier: string;
      evidence?: Record<string, unknown>;
    };

    if (!serviceId || !requestedTier) {
      return reply.code(400).send({ error: 'serviceId and requestedTier are required' });
    }

    const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
    if (!validTiers.includes(requestedTier)) {
      return reply.code(400).send({ error: `requestedTier must be one of: ${validTiers.join(', ')}` });
    }

    const db = getDb();
    const id = randomUUID();

    const [result] = await db
      .insert(verificationRequests)
      .values({
        id,
        serviceId,
        requestedTier,
        evidence: evidence || {},
        status: 'pending',
      })
      .returning();

    return reply.code(201).send({ data: result });
  });

  // GET /v1/verification/:id — check verification status
  app.get('/v1/verification/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    // Check credential first
    const [credential] = await db
      .select()
      .from(verificationCredentials)
      .where(eq(verificationCredentials.serviceId, id))
      .limit(1);

    if (credential) {
      return reply.send({ data: { type: 'credential', ...credential } });
    }

    // Check pending request
    const [request_] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.serviceId, id))
      .orderBy(desc(verificationRequests.createdAt))
      .limit(1);

    if (request_) {
      return reply.send({ data: { type: 'request', ...request_ } });
    }

    return reply.code(404).send({ error: 'No verification found for this service' });
  });

  // GET /v1/verification — list pending requests (admin)
  app.get('/v1/verification', async (request, reply) => {
    const { status, limit } = request.query as { status?: string; limit?: number };

    const db = getDb();
    const conditions = [];
    if (status) {
      conditions.push(eq(verificationRequests.status, status));
    }

    const results = await db
      .select()
      .from(verificationRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(verificationRequests.createdAt))
      .limit(limit || 20);

    return reply.send({ data: results });
  });
}
