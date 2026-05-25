import { Job } from 'bullmq';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import logger from '../../lib/logger';
import { decrypt } from '../../lib/crypto';
import { syncCommits } from '../../modules/analytics/sync/commits.sync';
import { syncPullRequests } from '../../modules/analytics/sync/pullrequests.sync';
import { syncIssues } from '../../modules/analytics/sync/issues.sync';
import { aggregateAnalytics } from '../../modules/analytics/aggregator';
import { syncWorkflows } from '../../modules/analytics/sync/workflows.sync';
import { SyncRepoJobData } from '@commitra/types';

import { analyticsQueue } from '../queues';
import { complexityService } from '../../modules/complexity/complexity.service';
import { emitJobProgress, emitJobCompleted, emitAnalyticsUpdated } from '../../lib/emit';
import { cacheService } from '../../lib/cache.service';

export const syncRepoProcessor = async (job: Job<SyncRepoJobData>) => {
  const { repositoryId, repoFullName, userId } = job.data;

  logger.info({ repositoryId, repoFullName, userId }, 'Processing sync job');

  try {
    // 0% Progress
    await job.updateProgress(0);
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 0, 'Starting repository sync...');

    const repo = await prisma.repository.findFirst({
      where: { id: repositoryId, userId },
      include: { user: true },
    });

    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found for user ${userId}`);
    }

    const githubToken = decrypt(repo.user.githubTokenEnc);

    // 1. Sync Commits (20%)
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 10, 'Syncing commits...');
    await syncCommits(repo.fullName, githubToken, repo.id, repo.defaultBranch);
    await job.updateProgress(20);
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 20, 'Commits synced');

    // 2. Sync PRs (40%)
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 30, 'Syncing pull requests...');
    await syncPullRequests(repo.fullName, githubToken, repo.id);
    await job.updateProgress(40);
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 40, 'Pull requests synced');

    // 3. Sync Issues (60%)
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 50, 'Syncing issues...');
    await syncIssues(repo.fullName, githubToken, repo.id);
    await job.updateProgress(60);
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 60, 'Issues synced');

    // 4. Sync Workflows (80%)
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 70, 'Syncing CI/CD workflows...');
    await syncWorkflows(repo.fullName, githubToken, repo.id);
    await job.updateProgress(80);
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 80, 'Workflows synced');

    // 5. Complexity Analysis (90%)
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 85, 'Analyzing code complexity...');
    await complexityService.analyzeRepository(repo.fullName, githubToken, repo.id, repo.defaultBranch);
    await job.updateProgress(90);
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 90, 'Complexity analysis done');

    // 6. Aggregate Analytics (95%)
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 92, 'Aggregating analytics...');
    await aggregateAnalytics(repo.id);
    await job.updateProgress(95);
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 95, 'Aggregation complete');

    // Update lastAnalyzedAt

    await prisma.repository.update({
      where: { id: repo.id },
      data: { lastAnalyzedAt: new Date() },
    });

    // Invalidate stale cache
    await cacheService.invalidateTag(`repo:${repo.id}`);
    
    // Warm cache concurrently
    cacheService.warmCache(repo.id, userId).catch(err => 
      logger.error({ repoId: repo.id, error: err.message }, 'Failed to warm cache after sync')
    );

    // 100% Progress
    await job.updateProgress(100);
    emitJobProgress(userId, repositoryId, job.id!, 'sync', 100, 'Sync complete');
    emitJobCompleted(userId, repositoryId, job.id!, 'sync');
    emitAnalyticsUpdated(userId, repositoryId);

    // Enqueue follow-up jobs
    await analyticsQueue.add('generate-health', {
      repositoryId,
      userId,
    });

    await analyticsQueue.add('generate-insights', {
      repositoryId,
      userId,
      insightTypes: ['summary', 'activity', 'recommendations'],
    });

    logger.info({ repositoryId, repoFullName }, 'Sync job completed successfully');
  } catch (error: any) {
    logger.error({ repositoryId, repoFullName, error: error.message }, 'Sync job failed');
    throw error;
  }
};
