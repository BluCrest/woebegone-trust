import { buildApp } from './app.js';
import { getConfig } from './config/index.js';
import { getLogger } from './utils/logger.js';
import { getDb } from './config/database.js';
import { services } from './db/schema/services.js';

async function seedIfNeeded() {
  const db = getDb();
  const [existing] = await db.select({ id: services.id }).from(services).limit(1);
  if (existing) return false;

  const logger = getLogger();
  logger.info('Database empty — running seed...');

  const { execSync } = await import('child_process');
  execSync('npm run seed', { stdio: 'inherit', cwd: process.cwd() });
  return true;
}

async function main() {
  const config = getConfig();
  const logger = getLogger();

  await seedIfNeeded();

  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`Trust Registry API running on port ${config.PORT}`);
    logger.info(`Docs available at http://localhost:${config.PORT}/docs`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

main();
