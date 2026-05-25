import { Worker, Job } from 'bullmq';
import { redis } from '../../lib/redis';
import { generateHealthProcessor } from '../processors/generateHealth.processor';
import { generateInsightsProcessor } from '../processors/generateInsights.processor';
import logger from '../../lib/logger';
import { notificationService } from '../../lib/notifications.service';
import { emitJobFailed } from '../../lib/emit';

export const analyticsWorker = new Worker(
  'repo-analytics',
  async (job: Job) => {
    if (job.name === 'generate-health') {
      return generateHealthProcessor(job);
    }
    if (job.name === 'generate-insights') {
      return generateInsightsProcessor(job);
    }
  },
  {
    connection: redis,
    concurrency: 2,
    settings: {
      backoffStrategies: {
        exponential: (attempts: number) => {
          return Math.pow(2, attempts - 1) * 10000;
        },
      },
    },
  }
);

analyticsWorker.on('completed', async (job) => {
  const { repositoryId, userId } = job.data;
  
  if (job.name === 'generate-health') {
    // Note: repoFullName might not be in health job data, let's assume it's just repositoryId
    // We could fetch repo name but let's keep it simple for now or check if it's available.
    await notificationService.addNotification(userId, {
      type: 'info',
      title: 'Health score updated',
      message: `Repository health analysis complete.`,
      repoId: repositoryId,
      actionUrl: `/repos/${repositoryId}/health`
    });
  } else if (job.name === 'generate-insights') {
    await notificationService.addNotification(userId, {
      type: 'success',
      title: 'AI insights ready',
      message: `New AI-powered insights have been generated.`,
      repoId: repositoryId,
      actionUrl: `/repos/${repositoryId}/ai`
    });
  }
  
  logger.info({ jobId: job.id, name: job.name }, 'Analytics job completed');
});

analyticsWorker.on('failed', async (job, err) => {
  if (job) {
    const { repositoryId, userId } = job.data;
    const type = job.name === 'generate-health' ? 'health' : 'insights';
    
    emitJobFailed(userId, repositoryId, job.id!, type, err.message);

    await notificationService.addNotification(userId, {
      type: 'error',
      title: `${type === 'health' ? 'Health analysis' : 'AI insights'} failed`,
      message: `Failed to complete ${type} task: ${err.message}`,
      repoId: repositoryId,
      actionUrl: `/repos/${repositoryId}/${type}`
    });
  }
  logger.error({ jobId: job?.id, name: job?.name, error: err.message }, 'Analytics job failed');
});
