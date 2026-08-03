import { Worker, type Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getLogger } from '../utils/logger.js';
import { collectServiceData } from '../modules/data-collection/aggregator.js';
import { calculateTrustScore } from '../modules/scoring/scoring.engine.js';
import { getServiceById, updateServiceScore } from '../modules/services/service.service.js';
import { getDb } from '../config/database.js';
import { dataPoints } from '../db/schema/data-points.js';
import { randomUUID } from 'crypto';

export function startWorkers() {
  const logger = getLogger();
  const connection = getRedis();

  // Data refresh worker
  const dataRefreshWorker = new Worker(
    'data-refresh',
    async (job: Job<{ serviceId: string }>) => {
      const { serviceId } = job.data;
      logger.info({ serviceId }, 'Processing data refresh job');

      const service = await getServiceById(serviceId);
      if (!service) {
        logger.warn({ serviceId }, 'Service not found, skipping');
        return;
      }

      const { factorData, rawData } = await collectServiceData({
        id: service.id,
        name: service.name,
        website: service.website || undefined,
        addresses: (service.addresses as Record<string, string[]>) || {},
      });

      // Store raw data points
      const db = getDb();
      for (const point of rawData) {
        await db.insert(dataPoints).values({
          id: randomUUID(),
          serviceId,
          category: point.dataType,
          source: point.source,
          data: point.data,
          confidence: point.confidence,
          collectedAt: point.collectedAt,
        });
      }

      // Trigger score recalculation
      const score = await calculateTrustScore(serviceId, factorData);
      await updateServiceScore(serviceId, {
        overallScore: score.score,
        grade: score.grade,
        confidence: score.confidence,
        factorBreakdown: Object.fromEntries(
          Object.entries(score.factors).map(([k, v]) => [k, { score: v.score, confidence: v.confidence, weight: v.weight }])
        ),
        methodologyVersion: score.methodologyVersion,
      });

      logger.info({ serviceId, score: score.score, grade: score.grade }, 'Data refresh complete');
      return { score: score.score, grade: score.grade };
    },
    { connection: connection.duplicate(), concurrency: 5 }
  );

  // Score recalculation worker
  const scoreRecalcWorker = new Worker(
    'score-recalculation',
    async (job: Job<{ serviceId: string }>) => {
      const { serviceId } = job.data;
      logger.info({ serviceId }, 'Processing score recalculation job');

      // This reuses existing data points to recalculate scores
      // Used when methodology changes
      const service = await getServiceById(serviceId);
      if (!service) return;

      const { factorData } = await collectServiceData({
        id: service.id,
        name: service.name,
        website: service.website || undefined,
        addresses: (service.addresses as Record<string, string[]>) || {},
      });

      const score = await calculateTrustScore(serviceId, factorData);
      await updateServiceScore(serviceId, {
        overallScore: score.score,
        grade: score.grade,
        confidence: score.confidence,
        factorBreakdown: Object.fromEntries(
          Object.entries(score.factors).map(([k, v]) => [k, { score: v.score, confidence: v.confidence, weight: v.weight }])
        ),
        methodologyVersion: score.methodologyVersion,
      });

      logger.info({ serviceId, score: score.score }, 'Score recalculation complete');
      return { score: score.score };
    },
    { connection: connection.duplicate(), concurrency: 3 }
  );

  dataRefreshWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Data refresh job failed');
  });

  scoreRecalcWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Score recalculation job failed');
  });

  logger.info('BullMQ workers started');
}
