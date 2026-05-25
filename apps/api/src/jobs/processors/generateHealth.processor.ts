import { Job } from 'bullmq';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import logger from '../../lib/logger';
import { HealthScoreCalculator } from '../../modules/analytics/health.calculator';
import { GenerateHealthJobData } from '@commitra/types';
import { emitHealthUpdated } from '../../lib/emit';

export const generateHealthProcessor = async (job: Job<GenerateHealthJobData>) => {
  const { repositoryId, userId } = job.data;

  logger.info({ repositoryId }, 'Calculating health score');

  try {
    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        commits: true,
        pullRequests: true,
        issues: true,
        healthScore: true,
      },
    });

    if (!repo) throw new Error('Repository not found');

    const calculator = new HealthScoreCalculator();

    const scores = {
      commitConsistency: calculator.calculateCommitConsistency(repo.commits),
      prHealthScore: calculator.calculatePRHealth(repo.pullRequests),
      issueHealthScore: calculator.calculateIssueHealth(repo.issues),
      codeActivityScore: calculator.calculateCodeActivity(repo.commits, repo),
      communityScore: calculator.calculateCommunityScore(repo, repo.pullRequests, repo.commits),
    };

    const overallScore = calculator.calculateOverallScore(scores);
    const grade = calculator.gradeFromScore(overallScore);
    const insights = calculator.generateScoreInsights(scores, repo.commits, repo.pullRequests, repo.issues);

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
