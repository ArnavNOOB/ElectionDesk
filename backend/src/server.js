import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';

async function startServer() {
  try {
    // 1. Connect to Database (real Mongo or high-fidelity In-Memory engine)
    await connectDB();

    // 2. Create Express App
    const app = createApp();

    // 4. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(`ElectionDesk API Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`Health check available at http://localhost:${env.PORT}/api/v1/health`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        await disconnectDB();
        logger.info('Database connections closed.');
        process.exit(0);
      });

      // Force close if graceful timeout exceeded
      setTimeout(() => {
        logger.error('Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Fatal Server Startup Error:', error);
    process.exit(1);
  }
}

startServer();
