import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getConfig } from './index.js';
import * as schema from '../db/schema/index.js';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const config = getConfig();
    const dbPath = resolve(process.cwd(), config.DATABASE_URL);
    mkdirSync(dirname(dbPath), { recursive: true });
    const client = new Database(dbPath);
    client.pragma('journal_mode = WAL');
    client.pragma('foreign_keys = ON');
    _db = drizzle(client, { schema });
  }
  return _db;
}
