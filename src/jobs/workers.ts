import { getLogger } from '../utils/logger.js';

export function startWorkers() {
  try {
    const { Worker } = require('bullmq');
    const { getRedis } = require('../config/redis.js');
    const { collectServiceData } = require('../modules/data-collection/aggregator.js');
    const { calculateTrustScore } = require('../modules/scoring/scoring.engine.js');
    const { getServiceById, updateServiceScore } = require('../modules/services/service.service.js');
    const { getDb } = require('../config/database.js');
    const { dataPoints } = require('../db/schema/data-points.js');
    const { randomUUID } = require('crypto');
    const connection = getRedis();

    const dataRefreshWorker = new Worker(
      'data-refresh',
      async (job: any) => {
        const { serviceId } = job.data;
        const logger = getLogger();
        logger.info({ serviceId }, 'Processing data refresh job');

        const service = await getServiceById(serviceId);
        if (!service) return;

        const { factorData, rawData } = await collectServiceData({
          id: service.id,
          name: service.name,
          website: service.website || undefined,
          addresses: typeof service.addresses === 'string' ? JSON.parse(service.addresses) : service.addresses || {},
        });

        const db = getDb();
        for (const point of rawData) {
          await db.insert(dataPoints).values({
            id: randomUUID(),
            serviceId,
            category: point.dataType,
            source: point.source,
            data: JSON.stringify(point.data),
            confidence: point.confidence,
          });
        }

        const score = await calculateTrustScore(serviceId, factorData);
        await updateServiceScore(serviceId, {
          overallScore: score.score,
          grade: score.grade,
          confidence: score.confidence,
          factorBreakdown: Object.fromEntries(
            Object.entries(score.factors).map(([k, v]: [string, any]) => [k, { score: v.score, confidence: v.confidence, weight: v.weight }])
          ),
          methodologyVersion: score.methodologyVersion,
        });

        return { score: score.score, grade: score.grade };
      },
      { connection: connection.duplicate(), concurrency: 5 }
    );

    const scoreRecalcWorker = new Worker(
      'score-recalculation',
      async (job: any) => {
        const { serviceId } = job.data;
        const service = await getServiceById(serviceId);
        if (!service) return;

        const { factorData } = await collectServiceData({
          id: service.id,
          name: service.name,
          website: service.website || undefined,
          addresses: typeof service.addresses === 'string' ? JSON.parse(service.addresses) : service.addresses || {},
        });

        const score = await calculateTrustScore(serviceId, factorData);
        await updateServiceScore(serviceId, {
          overallScore: score.score,
          grade: score.grade,
          confidence: score.confidence,
          factorBreakdown: Object.fromEntries(
            Object.entries(score.factors).map(([k, v]: [string, any]) => [k, { score: v.score, confidence: v.confidence, weight: v.weight }])
          ),
          methodologyVersion: score.methodologyVersion,
        });

        return { score: score.score };
      },
      { connection: connection.duplicate(), concurrency: 3 }
    );

    dataRefreshWorker.on('failed', (job: any, err: any) => {
      getLogger().error({ jobId: job?.id, err }, 'Data refresh job failed');
    });

    scoreRecalcWorker.on('failed', (job: any, err: any) => {
      getLogger().error({ jobId: job?.id, err }, 'Score recalculation job failed');
    });

    getLogger().info('BullMQ workers started');
  } catch {
    getLogger().warn('Redis unavailable, BullMQ workers not started');
  }
}
