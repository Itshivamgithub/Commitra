import { Job } from 'bullmq';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import logger from '../../lib/logger';
import { HealthScoreCalculator } from '../../modules/analytics/health.calculator';
import { GenerateHealthJobData } from '@commitra/types';
import { emitHealthUpdated } from '../../lib/emit';
import { subDays } from 'date-fns';

export const generateHealthProcessor = async (job: Job<GenerateHealthJobData>) => {
  const { repositoryId, userId } = job.data;

  logger.info({ repositoryId }, 'Calculating health score');

  try {
    const ninetyDaysAgo = subDays(new Date(), 90);

    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        healthScore: true,
      },
    });

    if (!repo) throw new Error('Repository not found');

    // Fetch related data separately with selection and filters to save memory
    const [commits, prs, issues] = await Promise.all([
      prisma.commit.findMany({
        where: { repositoryId, committedAt: { gte: ninetyDaysAgo } },
        select: { id: true, committedAt: true, additions: true, deletions: true, authorLogin: true },
      }),
      prisma.pullRequest.findMany({
        where: { repositoryId, createdAt: { gte: ninetyDaysAgo } },
        select: { id: true, state: true, createdAt: true, mergedAt: true, authorLogin: true },
      }),
      prisma.issue.findMany({
        where: { repositoryId, createdAt: { gte: ninetyDaysAgo } },
        select: { id: true, state: true, createdAt: true, closedAt: true },
      }),
    ]);

    const calculator = new HealthScoreCalculator();

    const scores = {
      commitConsistency: calculator.calculateCommitConsistency(commits as any),
      prHealthScore: calculator.calculatePRHealth(prs as any),
      issueHealthScore: calculator.calculateIssueHealth(issues as any),
      codeActivityScore: calculator.calculateCodeActivity(commits as any, repo),
      communityScore: calculator.calculateCommunityScore(repo, prs as any, commits as any),
    };

    const overallScore = calculator.calculateOverallScore(scores);
    const grade = calculator.gradeFromScore(overallScore);
    const insights = calculator.generateScoreInsights(scores, commits as any, prs as any, issues as any);

    const previousScore = repo.healthScore?.overallScore || null;
    const scoreDelta = previousScore !== null ? overallScore - previousScore : null;

    const healthScore = await prisma.healthScore.upsert({
      where: { repositoryId },
      update: {
        overallScore,
        commitConsistency: scores.commitConsistency,
        prHealthScore: scores.prHealthScore,
        issueHealthScore: scores.issueHealthScore,
        codeActivityScore: scores.codeActivityScore,
        communityScore: scores.communityScore,
        grade,
        insights,
        previousScore,
        scoreDelta,
        calculatedAt: new Date(),
      },
      create: {
        repositoryId,
        overallScore,
        commitConsistency: scores.commitConsistency,
        prHealthScore: scores.prHealthScore,
        issueHealthScore: scores.issueHealthScore,
        codeActivityScore: scores.codeActivityScore,
        communityScore: scores.communityScore,
        grade,
        insights,
        previousScore,
        scoreDelta,
      },
    });

    // Invalidate health cache
    await redis.del(`health:${repositoryId}`);

    // Emit socket event
    emitHealthUpdated(userId, repositoryId, overallScore, grade, scoreDelta);

    logger.info({ repositoryId, overallScore, grade }, 'Health score calculated and saved');
  } catch (error: any) {
    logger.error({ repositoryId, error: error.message }, 'Failed to calculate health score');
    throw error;
  }
};
