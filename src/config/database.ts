import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from './index.js';
import * as schema from '../db/schema/index.js';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const config = getConfig();
    const client = postgres(config.DATABASE_URL);
    _db = drizzle(client, { schema });
  }
  return _db;
}
