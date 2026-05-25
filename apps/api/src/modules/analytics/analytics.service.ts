import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/crypto';
import logger from '../../lib/logger';
import { syncCommits } from './sync/commits.sync';
import { syncPullRequests } from './sync/pullrequests.sync';
import { syncIssues } from './sync/issues.sync';
import { aggregateAnalytics } from './aggregator';
import { subDays, startOfDay, differenceInHours, format } from 'date-fns';
import { cacheService } from '../../lib/cache.service';

export class AnalyticsService {
  /**
   * Helper to get repository by ID and verify ownership
   */
  async getRepoById(userId: string, repoId: string) {
    return prisma.repository.findFirst({
      where: {
        id: repoId,
        userId,
      },
    });
  }

  /**
   * Triggers full sync of repo data and aggregates it
   * (Used by BullMQ worker, no caching here as it's a mutation)
   */
  async syncRepoData(repoId: string, userId: string) {
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, userId },
      include: { user: true },
    });

    if (!repo) throw new Error('Repository not found');

    const githubToken = decrypt(repo.user.githubTokenEnc);

    // Sequential sync to avoid rate limits
    const commitsCount = await syncCommits(repo.fullName, githubToken, repo.id, repo.defaultBranch);
    const prsCount = await syncPullRequests(repo.fullName, githubToken, repo.id);
    const issuesCount = await syncIssues(repo.fullName, githubToken, repo.id);

    // Aggregate snapshots
    await aggregateAnalytics(repo.id);

    // Update lastAnalyzedAt
    await prisma.repository.update({
      where: { id: repo.id },
      data: { lastAnalyzedAt: new Date() },
    });

    return {
      commits: commitsCount,
      pullRequests: prsCount,
      issues: issuesCount,
    };
  }

  async getOverview(repoId: string) {
    const key = `analytics:${repoId}:overview`;
    const tag = `repo:${repoId}`;

    const { data } = await cacheService.getStaleOrFresh(
      key,
      async () => {
        const [commits, prs, issues, repo] = await Promise.all([
          prisma.commit.count({ where: { repositoryId: repoId } }),
          prisma.pullRequest.findMany({ where: { repositoryId: repoId } }),
          prisma.issue.findMany({ where: { repositoryId: repoId } }),
          prisma.repository.findUnique({ where: { id: repoId } }),
        ]);

        const mergedPRs = prs.filter((p) => p.state === 'merged');
        const openPRs = prs.filter((p) => p.state === 'open');
        const closedIssues = issues.filter((i) => i.state === 'closed');
        const openIssues = issues.filter((i) => i.state === 'open');

        // Avg PR Merge Time
        let avgPRMergeTime = 0;
        if (mergedPRs.length > 0) {
          const totalHours = mergedPRs.reduce((sum, p) => {
            return sum + differenceInHours(new Date(p.mergedAt!), new Date(p.createdAt));
          }, 0);
          avgPRMergeTime = totalHours / mergedPRs.length;
        }

        // Avg Issue Close Time
        let avgIssueCloseTime = 0;
        if (closedIssues.length > 0) {
          const totalHours = closedIssues.reduce((sum, i) => {
            return sum + differenceInHours(new Date(i.closedAt!), new Date(i.createdAt));
          }, 0);
          avgIssueCloseTime = totalHours / closedIssues.length;
        }

        // Top Contributors
        const contributorStats = await prisma.commit.groupBy({
          by: ['authorLogin'],
          where: { repositoryId: repoId },
          _count: { _all: true },
          _sum: { additions: true, deletions: true },
          orderBy: { _count: { authorLogin: 'desc' } },
          take: 10,
        });

        const topContributors = contributorStats.map((c) => ({
          login: c.authorLogin,
          commits: c._count._all,
          additions: c._sum.additions || 0,
          deletions: c._sum.deletions || 0,
        }));

        const result = {
          totalCommits: commits,
          totalPRs: prs.length,
          mergedPRs: mergedPRs.length,
          openPRs: openPRs.length,
          totalIssues: issues.length,
          openIssues: openIssues.length,
          closedIssues: closedIssues.length,
          avgPRMergeTime,
          avgIssueCloseTime,
          topContributors,
          mostUsedLanguage: repo?.language || null,
        };

        await cacheService.tagKey(tag, key);
        return result;
      },
      3600, // 1 hour fresh
      86400 // 24 hours stale
    );

    return data;
  }

  async getCommits(repoId: string, range: '7d' | '30d' | '90d' = '30d') {
    const key = `analytics:${repoId}:commits:${range}`;
    const tag = `repo:${repoId}`;
    const daysCount = parseInt(range);
    
    return cacheService.getOrSet(key, async () => {
      const startDate = startOfDay(subDays(new Date(), daysCount));
      
      const snapshots = await prisma.analyticsSnapshot.findMany({
        where: {
          repositoryId: repoId,
          snapshotDate: { gte: startDate },
        },
        orderBy: { snapshotDate: 'asc' },
      });

      const timeline = snapshots.map((s) => ({
        date: format(s.snapshotDate, 'yyyy-MM-dd'),
        count: s.commitCount,
        additions: s.additions,
        deletions: s.deletions,
      }));

      const totalInRange = timeline.reduce((sum, t) => sum + t.count, 0);
      
      let peakDay = { date: '', count: 0 };
      if (timeline.length > 0) {
        peakDay = timeline.reduce((max, t) => (t.count > max.count ? { date: t.date, count: t.count } : max), { date: '', count: 0 });
      }

      const result = {
        timeline,
        totalInRange,
        peakDay,
      };

      await cacheService.tagKey(tag, key);
      return result;
    }, 3600);
  }

  async getCommitsList(repoId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [commits, total] = await Promise.all([
      prisma.commit.findMany({
        where: { repositoryId: repoId },
        orderBy: { committedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.commit.count({ where: { repositoryId: repoId } }),
    ]);

    return {
      commits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContributors(repoId: string) {
    const key = `analytics:${repoId}:contributors`;
    const tag = `repo:${repoId}`;

    return cacheService.getOrSet(key, async () => {
      const commits = await prisma.commit.findMany({
        where: { repositoryId: repoId },
        select: {
          authorLogin: true,
          additions: true,
          deletions: true,
          committedAt: true,
        },
      });

      const totalCommitsCount = commits.length;
      const stats: Record<string, any> = {};

      commits.forEach((c) => {
        const login = c.authorLogin || 'unknown';
        if (!stats[login]) {
          stats[login] = {
            login,
            totalCommits: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            firstCommit: c.committedAt,
            lastCommit: c.committedAt,
          };
        }

        stats[login].totalCommits++;
        stats[login].totalAdditions += c.additions;
        stats[login].totalDeletions += c.deletions;
        if (c.committedAt < stats[login].firstCommit) stats[login].firstCommit = c.committedAt;
        if (c.committedAt > stats[login].lastCommit) stats[login].lastCommit = c.committedAt;
      });

      const contributors = Object.values(stats).map((s: any) => ({
        ...s,
        percentageOfTotal: totalCommitsCount > 0 ? parseFloat(((s.totalCommits / totalCommitsCount) * 100).toFixed(1)) : 0,
      })).sort((a, b) => b.totalCommits - a.totalCommits);

      const result = { contributors };
      await cacheService.tagKey(tag, key);
      return result;
    }, 3600);
  }

  async getPullRequests(repoId: string, range: '7d' | '30d' | '90d' = '30d') {
    const key = `analytics:${repoId}:pullrequests:${range}`;
    const tag = `repo:${repoId}`;
    const daysCount = parseInt(range);

    return cacheService.getOrSet(key, async () => {
      const startDate = startOfDay(subDays(new Date(), daysCount));
      
      const snapshots = await prisma.analyticsSnapshot.findMany({
        where: {
          repositoryId: repoId,
          snapshotDate: { gte: startDate },
        },
        orderBy: { snapshotDate: 'asc' },
      });

      const prs = await prisma.pullRequest.findMany({
        where: {
          repositoryId: repoId,
          createdAt: { gte: startDate },
        },
      });

      const timeline = snapshots.map((s) => {
        const dayStart = startOfDay(s.snapshotDate);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        // Calculate closed (not merged) for this day from the PRs data
        const closedCount = prs.filter(p => 
          p.state === 'closed' && 
          p.closedAt && 
          p.closedAt >= dayStart && 
          p.closedAt <= dayEnd
        ).length;

        return {
          date: format(s.snapshotDate, 'yyyy-MM-dd'),
          opened: s.prOpened,
          merged: s.prMerged,
          closed: closedCount,
        };
      });

      const mergedPRs = prs.filter(p => p.state === 'merged');
      const closedPRs = prs.filter(p => p.state === 'closed' || p.state === 'merged');

      let avgMergeTimeHours = 0;
      if (mergedPRs.length > 0) {
        const totalHours = mergedPRs.reduce((sum, p) => sum + differenceInHours(new Date(p.mergedAt!), new Date(p.createdAt)), 0);
        avgMergeTimeHours = totalHours / mergedPRs.length;
      }

      const mergeRate = closedPRs.length > 0 ? (mergedPRs.length / closedPRs.length) * 100 : 0;

      const reviewStats = {
        avgReviewCount: prs.length > 0 ? prs.reduce((sum, p) => sum + p.reviewCount, 0) / prs.length : 0,
        avgCommentCount: prs.length > 0 ? prs.reduce((sum, p) => sum + p.commentCount, 0) / prs.length : 0,
      };

      const result = {
        timeline,
        avgMergeTimeHours,
        mergeRate,
        reviewStats,
      };

      await cacheService.tagKey(tag, key);
      return result;
    }, 3600);
  }

  async getIssues(repoId: string, range: '7d' | '30d' | '90d' = '30d') {
    const key = `analytics:${repoId}:issues:${range}`;
    const tag = `repo:${repoId}`;
    const daysCount = parseInt(range);

    return cacheService.getOrSet(key, async () => {
      const startDate = startOfDay(subDays(new Date(), daysCount));
      
      const snapshots = await prisma.analyticsSnapshot.findMany({
        where: {
          repositoryId: repoId,
          snapshotDate: { gte: startDate },
        },
        orderBy: { snapshotDate: 'asc' },
      });

      const timeline = snapshots.map((s) => ({
        date: format(s.snapshotDate, 'yyyy-MM-dd'),
        opened: s.issuesOpened,
        closed: s.issuesClosed,
      }));

      const issues = await prisma.issue.findMany({
        where: {
          repositoryId: repoId,
          createdAt: { gte: startDate },
        },
      });

      const closedIssues = issues.filter(i => i.state === 'closed');
      
      let avgCloseTimeHours = 0;
      if (closedIssues.length > 0) {
        const totalHours = closedIssues.reduce((sum, i) => sum + differenceInHours(new Date(i.closedAt!), new Date(i.createdAt)), 0);
        avgCloseTimeHours = totalHours / closedIssues.length;
      }

      const resolutionRate = issues.length > 0 ? (closedIssues.length / issues.length) * 100 : 0;

      const labelsMap: Record<string, number> = {};
      issues.forEach(i => {
        i.labels.forEach(label => {
          labelsMap[label] = (labelsMap[label] || 0) + 1;
        });
      });

      const topLabels = Object.entries(labelsMap)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const result = {
        timeline,
        avgCloseTimeHours,
        resolutionRate,
        topLabels,
      };

      await cacheService.tagKey(tag, key);
      return result;
    }, 3600);
  }

  async getHealth(repoId: string) {
    const key = `health:${repoId}`;
    const tag = `repo:${repoId}`;

    return cacheService.getOrSet(key, async () => {
      const health = await prisma.healthScore.findUnique({
        where: { repositoryId: repoId },
      });

      if (!health) {
        throw new Error('Health score not found for this repository. Please run a sync first.');
      }

      const result = {
        overallScore: health.overallScore,
        grade: health.grade,
        categories: {
          commitConsistency: { score: health.commitConsistency, label: this.getScoreLabel(health.commitConsistency) },
          prHealth: { score: health.prHealthScore, label: this.getScoreLabel(health.prHealthScore) },
          issueHealth: { score: health.issueHealthScore, label: this.getScoreLabel(health.issueHealthScore) },
          codeActivity: { score: health.codeActivityScore, label: this.getScoreLabel(health.codeActivityScore) },
          community: { score: health.communityScore, label: this.getScoreLabel(health.communityScore) },
        },
        insights: health.insights,
        scoreDelta: health.scoreDelta,
        calculatedAt: health.calculatedAt.toISOString(),
      };

      await cacheService.tagKey(tag, key);
      return result;
    }, 3600);
  }

  async getCicd(repoId: string, range: '7d' | '30d' | '90d' = '30d') {
    const key = `analytics:${repoId}:cicd:${range}`;
    const tag = `repo:${repoId}`;
    const daysCount = parseInt(range);

    return cacheService.getOrSet(key, async () => {
      const startDate = startOfDay(subDays(new Date(), daysCount));

      const runs = await prisma.workflowRun.findMany({
        where: {
          repositoryId: repoId,
          startedAt: { gte: startDate }
        },
        orderBy: { startedAt: 'desc' }
      });

      if (runs.length === 0) {
        const result = {
          summary: { totalRuns: 0, successRate: 0, avgDurationSeconds: 0, deploymentFrequency: 0, mostFailedWorkflow: null, lastRunAt: null, lastRunConclusion: null },
          timeline: [],
          byWorkflow: [],
          recentRuns: []
        };
        await cacheService.tagKey(tag, key);
        return result;
      }

      const completedRuns = runs.filter(r => r.conclusion !== null);
      const successfulRuns = runs.filter(r => r.conclusion === 'success');
      const failedRuns = runs.filter(r => r.conclusion === 'failure');

      // Summary Stats
      const successRate = completedRuns.length > 0 ? (successfulRuns.length / completedRuns.length) * 100 : 0;
      const totalDuration = completedRuns.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
      const avgDurationSeconds = completedRuns.length > 0 ? totalDuration / completedRuns.length : 0;
      const deploymentFrequency = successfulRuns.length / daysCount;

      const workflowFailures: Record<string, number> = {};
      failedRuns.forEach(r => {
        workflowFailures[r.workflowName] = (workflowFailures[r.workflowName] || 0) + 1;
      });
      let mostFailedWorkflow = null;
      let maxFails = 0;
      for (const [name, fails] of Object.entries(workflowFailures)) {
        if (fails > maxFails) {
          maxFails = fails;
          mostFailedWorkflow = name;
        }
      }

      const lastRun = runs[0];

      // Timeline (group by day)
      const timelineMap: Record<string, { total: number, success: number, failure: number, cancelled: number }> = {};
      runs.forEach(r => {
        const dateStr = format(r.startedAt, 'yyyy-MM-dd');
        if (!timelineMap[dateStr]) {
          timelineMap[dateStr] = { total: 0, success: 0, failure: 0, cancelled: 0 };
        }
        timelineMap[dateStr].total++;
        if (r.conclusion === 'success') timelineMap[dateStr].success++;
        if (r.conclusion === 'failure') timelineMap[dateStr].failure++;
        if (r.conclusion === 'cancelled' || r.conclusion === 'skipped') timelineMap[dateStr].cancelled++;
      });
      const timeline = Object.entries(timelineMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));

      // By Workflow
      const byWorkflowMap: Record<string, { totalRuns: number, successCount: number, totalDuration: number, completedCount: number }> = {};
      runs.forEach(r => {
        if (!byWorkflowMap[r.workflowName]) {
          byWorkflowMap[r.workflowName] = { totalRuns: 0, successCount: 0, totalDuration: 0, completedCount: 0 };
        }
        byWorkflowMap[r.workflowName].totalRuns++;
        if (r.conclusion === 'success') byWorkflowMap[r.workflowName].successCount++;
        if (r.durationSeconds !== null) {
          byWorkflowMap[r.workflowName].totalDuration += r.durationSeconds;
          byWorkflowMap[r.workflowName].completedCount++;
        }
      });
      const byWorkflow = Object.entries(byWorkflowMap).map(([workflowName, data]) => ({
        workflowName,
        totalRuns: data.totalRuns,
        successRate: data.totalRuns > 0 ? (data.successCount / data.totalRuns) * 100 : 0,
        avgDurationSeconds: data.completedCount > 0 ? data.totalDuration / data.completedCount : 0
      })).sort((a, b) => b.totalRuns - a.totalRuns);

      // Recent Runs (top 10)
      const recentRuns = runs.slice(0, 10).map(r => ({
        workflowName: r.workflowName,
        branch: r.branch,
        conclusion: r.conclusion || r.status,
        durationSeconds: r.durationSeconds || 0,
        startedAt: r.startedAt.toISOString(),
        triggeredBy: r.triggeredBy || 'unknown'
      }));

      const result = {
        summary: {
          totalRuns: runs.length,
          successRate,
          avgDurationSeconds,
          deploymentFrequency,
          mostFailedWorkflow,
          lastRunAt: lastRun.startedAt.toISOString(),
          lastRunConclusion: lastRun.conclusion || lastRun.status
        },
        timeline,
        byWorkflow,
        recentRuns
      };

      await cacheService.tagKey(tag, key);
      return result;
    }, 3600);
  }

  async compareRepos(userId: string, repoIds: string[]) {
    // Verify ownership
    const repos = await prisma.repository.findMany({
      where: {
        id: { in: repoIds },
        userId
      },
      include: {
        healthScore: true
      }
    });

    if (repos.length !== repoIds.length) {
      throw new Error('One or more repositories not found or access denied');
    }

    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));

    const repoMetrics = await Promise.all(repos.map(async (repo) => {
      const [commits, prs, issues, cicdRuns, topContributorStats] = await Promise.all([
        prisma.commit.count({ where: { repositoryId: repo.id, committedAt: { gte: thirtyDaysAgo } } }),
        prisma.pullRequest.findMany({ where: { repositoryId: repo.id, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.issue.findMany({ where: { repositoryId: repo.id, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.workflowRun.findMany({ where: { repositoryId: repo.id, startedAt: { gte: thirtyDaysAgo }, conclusion: { not: null } } }),
        prisma.commit.groupBy({
          by: ['authorLogin'],
          where: { repositoryId: repo.id, committedAt: { gte: thirtyDaysAgo } },
          _count: { _all: true },
          orderBy: { _count: { authorLogin: 'desc' } },
          take: 1
        })
      ]);

      const mergedPRs = prs.filter(p => p.state === 'merged');
      const closedIssues = issues.filter(i => i.state === 'closed');
      const successfulRuns = cicdRuns.filter(r => r.conclusion === 'success');

      let avgPRMergeHours = 0;
      if (mergedPRs.length > 0) {
        const totalHours = mergedPRs.reduce((sum, p) => sum + differenceInHours(new Date(p.mergedAt!), new Date(p.createdAt)), 0);
        avgPRMergeHours = totalHours / mergedPRs.length;
      }

      const successRate = cicdRuns.length > 0 ? (successfulRuns.length / cicdRuns.length) * 100 : null;

      return {
        repoId: repo.id,
        repoName: repo.name,
        metrics: {
          commits30d: commits,
          mergedPRs30d: mergedPRs.length,
          closedIssues30d: closedIssues.length,
          healthScore: repo.healthScore?.overallScore || 0,
          grade: repo.healthScore?.grade || 'N/A',
          avgPRMergeHours,
          successRate,
          topContributor: topContributorStats.length > 0 ? topContributorStats[0].authorLogin : null
        }
      };
    }));

    let winner = null;
    let highestHealth = -1;
    repoMetrics.forEach(r => {
      if (r.metrics.healthScore > highestHealth) {
        highestHealth = r.metrics.healthScore;
        winner = { repoId: r.repoId, repoName: r.repoName };
      }
    });

    return {
      repos: repoMetrics,
      winner
    };
  }

  private getScoreLabel(score: number): string {
    if (score >= 80) return 'Strong';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
