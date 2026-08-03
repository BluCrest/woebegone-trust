import { buildApp } from './app.js';
import { getConfig } from './config/index.js';
import { getLogger } from './utils/logger.js';

async function main() {
  const config = getConfig();
  const logger = getLogger();

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
