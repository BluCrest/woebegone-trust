import type { FastifyInstance } from 'fastify';
import { DEFAULT_METHODOLOGY } from '../../../modules/scoring/methodology.js';
import { getDb } from '../../../config/database.js';
import { methodologies } from '../../../db/schema/methodology.js';
import { eq, desc } from 'drizzle-orm';

export async function methodologyRoutes(app: FastifyInstance) {
  // GET /v1/methodology — current scoring methodology
  app.get('/v1/methodology', async (_request, reply) => {
    const db = getDb();

    // Try to get active methodology from DB
    const [active] = await db
      .select()
      .from(methodologies)
      .where(eq(methodologies.isActive, 1))
      .orderBy(desc(methodologies.createdAt))
      .limit(1);

    if (active) {
      return reply.send({
        data: {
          version: active.version,
          factors: JSON.parse(active.factors),
          thresholds: JSON.parse(active.thresholds),
          changelog: active.changelog,
        },
      });
    }

    // Fallback to default
    return reply.send({ data: DEFAULT_METHODOLOGY });
  });

  // GET /v1/methodology/versions — list all versions
  app.get('/v1/methodology/versions', async (_request, reply) => {
    const db = getDb();

    const versions = await db
      .select()
      .from(methodologies)
      .orderBy(desc(methodologies.createdAt));

    if (versions.length === 0) {
      // Seed the default version
      await db.insert(methodologies).values({
        version: DEFAULT_METHODOLOGY.version,
        factors: JSON.stringify(DEFAULT_METHODOLOGY.factors),
        thresholds: JSON.stringify(DEFAULT_METHODOLOGY.thresholds),
        changelog: DEFAULT_METHODOLOGY.changelog,
        isActive: 1,
      });

      return reply.send({
        data: [
          {
            version: DEFAULT_METHODOLOGY.version,
            changelog: DEFAULT_METHODOLOGY.changelog,
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }

    return reply.send({
      data: versions.map((v) => ({
        version: v.version,
        changelog: v.changelog,
        isActive: v.isActive === 1,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  });

  // GET /v1/methodology/:version — get specific version
  app.get('/v1/methodology/:version', async (request, reply) => {
    const { version } = request.params as { version: string };
    const db = getDb();

    const [methodology] = await db
      .select()
      .from(methodologies)
      .where(eq(methodologies.version, version))
      .limit(1);

    if (!methodology) {
      return reply.code(404).send({ error: 'Methodology version not found' });
    }

    return reply.send({
      data: {
        version: methodology.version,
        factors: JSON.parse(methodology.factors),
        thresholds: JSON.parse(methodology.thresholds),
        changelog: methodology.changelog,
        isActive: methodology.isActive === 1,
        createdAt: methodology.createdAt.toISOString(),
      },
    });
  });
}
