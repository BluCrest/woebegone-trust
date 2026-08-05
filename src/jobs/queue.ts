import { getLogger } from '../utils/logger.js';

let _queues: any = null;
let _redisAvailable = false;

export function getQueues() {
  if (_queues) return _queues;
  try {
    const { Queue } = require('bullmq');
    const { getRedis } = require('../config/redis.js');
    const connection = getRedis();
    _queues = {
      dataRefresh: new Queue('data-refresh', { connection: connection.duplicate() }),
      scoreRecalculation: new Queue('score-recalculation', { connection: connection.duplicate() }),
    };
    _redisAvailable = true;
  } catch {
    _redisAvailable = false;
  }
  return _queues;
}

export function isRedisAvailable() {
  return _redisAvailable;
}

export async function addDataRefreshJob(serviceId: string) {
  const queues = getQueues();
  if (!queues) {
    getLogger().warn({ serviceId }, 'Redis unavailable, skipping data refresh job');
    return;
  }
  const logger = getLogger();
  await queues.dataRefresh.add(
    'refresh-service',
    { serviceId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
  logger.info({ serviceId }, 'Data refresh job queued');
}

export async function addScoreRecalculationJob(serviceId: string) {
  const queues = getQueues();
  if (!queues) {
    getLogger().warn({ serviceId }, 'Redis unavailable, skipping score recalculation job');
    return;
  }
  const logger = getLogger();
  await queues.scoreRecalculation.add(
    'recalculate',
    { serviceId },
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
  logger.info({ serviceId }, 'Score recalculation job queued');
}
