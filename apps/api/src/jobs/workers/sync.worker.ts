import { Worker, Job } from 'bullmq';
import { redis } from '../../lib/redis';
import { syncRepoProcessor } from '../processors/syncRepo.processor';
import logger from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { subHours } from 'date-fns';
import { syncQueue } from '../queues';
import { emitJobFailed } from '../../lib/emit';
import { notificationService } from '../../lib/notifications.service';

export const syncWorker = new Worker(
  'repo-sync',
  async (job: Job) => {
    if (job.name === 'sync-repo') {
      return syncRepoProcessor(job);
    }

    if (job.name === 'nightly-sync') {
      logger.info('Running nightly sync producer');
      const staleRepos = await prisma.repository.findMany({
        where: {
          OR: [
            { lastAnalyzedAt: null },
            { lastAnalyzedAt: { lt: subHours(new Date(), 24) } },
          ],
        },
        take: 50,
      });

      for (const repo of staleRepos) {
        await syncQueue.add('sync-repo', {
          repositoryId: repo.id,
          repoFullName: repo.fullName,
          userId: repo.userId,
          triggeredBy: 'scheduled',
        });
      }
      return { enqueued: staleRepos.length };
    }
  },
  {
    connection: redis,
    concurrency: 3,
    settings: {
      backoffStrategies: {
        exponential: (attempts: number) => {
          return Math.pow(2, attempts - 1) * 5000;
        },
      },
    },
  }
);

syncWorker.on('completed', async (job) => {
  if (job.name === 'sync-repo') {
    const { repositoryId, repoFullName, userId } = job.data;
    // We could add a notification here, but the processor already emits socket events.
    // Let's add a persistent notification for major completions.
    await notificationService.addNotification(userId, {
      type: 'success',
      title: 'Sync complete',
      message: `${repoFullName} synced successfully`,
      repoId: repositoryId,
      actionUrl: `/repos/${repositoryId}`
    });
  }
});

syncWorker.on('failed', async (job, err) => {
  if (job?.name === 'sync-repo') {
    const { repositoryId, repoFullName, userId } = job.data;
    
    emitJobFailed(userId, repositoryId, job.id!, 'sync', err.message);
    
    await notificationService.addNotification(userId, {
      type: 'error',
      title: 'Sync failed',
      message: `Failed to sync ${repoFullName}: ${err.message}`,
      repoId: repositoryId,
      actionUrl: `/repos/${repositoryId}`
    });
  }
  logger.error({ jobId: job?.id, error: err.message }, 'Sync job failed');
});
