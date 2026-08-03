import { Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getLogger } from '../utils/logger.js';

let _queues: {
  dataRefresh: Queue;
  scoreRecalculation: Queue;
} | null = null;

export function getQueues() {
  if (!_queues) {
    const connection = getRedis();
    _queues = {
      dataRefresh: new Queue('data-refresh', { connection: connection.duplicate() }),
      scoreRecalculation: new Queue('score-recalculation', { connection: connection.duplicate() }),
    };
  }
  return _queues;
}

export async function addDataRefreshJob(serviceId: string) {
  const queues = getQueues();
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
