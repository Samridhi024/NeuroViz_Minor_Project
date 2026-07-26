import cron from 'node-cron';
import prisma from '../lib/db.js';
import { logger } from '../lib/logger.js';

/**
 * Batch Expiry Cron Job
 * Runs every hour to:
 * 1. Flag ACTIVE batches whose best_before_date has passed
 * 2. Re-flag EXTENDED batches whose extended_until date has passed
 */
export function startBatchExpiryCron(): void {
  cron.schedule('0 * * * *', async () => {
    logger.info('[Cron] Running batch expiry check...');
    const now = new Date();

    try {
      // Flag expired ACTIVE batches
      const flaggedActive = await prisma.batch.updateMany({
        where: {
          status: 'ACTIVE',
          bestBeforeDate: { lte: now },
        },
        data: { status: 'FLAGGED' },
      });

      if (flaggedActive.count > 0) {
        logger.warn(`[Cron] Flagged ${flaggedActive.count} expired ACTIVE batches`);
      }

      // Re-flag expired EXTENDED batches
      const flaggedExtended = await prisma.batch.updateMany({
        where: {
          status: 'EXTENDED',
          extendedUntil: { lte: now },
        },
        data: { status: 'FLAGGED', extendedUntil: null },
      });

      if (flaggedExtended.count > 0) {
        logger.warn(`[Cron] Re-flagged ${flaggedExtended.count} expired EXTENDED batches`);
      }

      // TODO: Send admin notifications for flagged batches

      logger.info('[Cron] Batch expiry check complete');
    } catch (error) {
      logger.error('[Cron] Batch expiry check failed:', error);
    }
  });

  logger.info('[Cron] Batch expiry cron scheduled (every hour)');
}
