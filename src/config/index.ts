import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

loadDotenv({ path: resolve(process.cwd(), '.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  ETHERSCAN_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  CER_LIVE_API_KEY: z.string().optional(),
  INFURA_URL: z.string().optional(),
  PRIVATE_KEY: z.string().optional(),
  IPFS_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _config: Env | null = null;

export function getConfig(): Env {
  if (!_config) {
    _config = envSchema.parse(process.env);
  }
  return _config;
}
