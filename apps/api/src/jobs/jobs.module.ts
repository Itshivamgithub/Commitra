import './workers/sync.worker';
import './workers/analytics.worker';
import { syncQueue } from './queues';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { subHours } from 'date-fns';

export const initJobs = async () => {
  logger.info('Initializing background jobs');

  // Schedule nightly sync (runs daily at 2am UTC)
  // Cap at 50 repos per nightly run to avoid rate limits
  await syncQueue.add(
    'nightly-sync',
    {},
    {
      repeat: { pattern: '0 2 * * *' },
    }
  );

  // Note: nightly-sync job needs its own processor or handled in syncWorker
  // Since we want to query all repos and enqueue one job per repo, 
  // we can add a specific job name handler.
};

// Add nightly-sync handler to syncWorker or a separate worker
// For simplicity, I'll update the sync.worker.ts logic to handle multiple job names
// But the prompt says "Nightly scheduled sync enqueues jobs for stale repos"
// So the nightly-sync job should just be a producer.
