import { Redis } from 'ioredis';
import { getConfig } from './index.js';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const config = getConfig();
    if (!config.REDIS_URL) {
      throw new Error('REDIS_URL is required for Redis connection');
    }
    _redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _redis;
}
