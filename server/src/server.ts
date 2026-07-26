import { createServer } from 'http';
import app from './app.js';
import { initializeSocket } from './lib/socket.js';
import { logger } from './lib/logger.js';
import redis from './lib/redis.js';
import prisma from './lib/db.js';
import reservationWorker from './workers/reservationExpiryWorker.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const httpServer = createServer(app);
initializeSocket(httpServer);

async function start() {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info('Redis connected');

    // Verify database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Reservation worker imported — it starts processing on instantiation.

    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔌 Socket.IO ready`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    httpServer.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      logger.info('Server shut down complete');
      process.exit(0);
    });
  });
});

start();
