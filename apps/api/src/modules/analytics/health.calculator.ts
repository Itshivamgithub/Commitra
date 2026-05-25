import { Commit, PullRequest, Issue, Repository } from '@prisma/client';
import { subDays, startOfWeek, endOfWeek, differenceInHours, isAfter, isBefore } from 'date-fns';

export interface CategoryScores {
  commitConsistency: number;
  prHealthScore: number;
  issueHealthScore: number;
  codeActivityScore: number;
  communityScore: number;
}

export class HealthScoreCalculator {
  calculateCommitConsistency(commits: Commit[]): number {
    const ninetyDaysAgo = subDays(new Date(), 90);
    const recentCommits = commits.filter(c => isAfter(new Date(c.committedAt), ninetyDaysAgo));
    
    // Group by week
    const weeksMap: Record<string, number> = {};
    for (let i = 0; i < 13; i++) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7));
      weeksMap[weekStart.toISOString()] = 0;
    }

    recentCommits.forEach(c => {
      const weekStart = startOfWeek(new Date(c.committedAt)).toISOString();
      if (weeksMap[weekStart] !== undefined) {
        weeksMap[weekStart]++;
      }
    });

    const activeWeeks = Object.values(weeksMap).filter(count => count > 0).length;
    let score = (activeWeeks / 13) * 100;

    // Bonus for low standard deviation (consistency)
    const counts = Object.values(weeksMap);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < mean * 0.5 && mean > 0) score += 10;

    // Penalty for no commits in last 14 days
    const fourteenDaysAgo = subDays(new Date(), 14);
    const veryRecentCommits = recentCommits.filter(c => isAfter(new Date(c.committedAt), fourteenDaysAgo));
    if (veryRecentCommits.length === 0) score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  calculatePRHealth(prs: PullRequest[]): number {
    if (prs.length === 0) return 40;

    const closedPRs = prs.filter(p => p.state === 'closed' || p.state === 'merged');
    const mergedPRs = prs.filter(p => p.state === 'merged');
    
    const mergeRate = closedPRs.length > 0 ? mergedPRs.length / closedPRs.length : 0;
    const mergeRateScore = mergeRate * 40;

    let totalMergeHours = 0;
    mergedPRs.forEach(p => {
      if (p.mergedAt) {
        totalMergeHours += differenceInHours(new Date(p.mergedAt), new Date(p.createdAt));
      }
    });
    const avgMergeHours = mergedPRs.length > 0 ? totalMergeHours / mergedPRs.length : 9999;

    let speedScore = 0;
    if (avgMergeHours < 24) speedScore = 30;
    else if (avgMergeHours < 72) speedScore = 20;
    else if (avgMergeHours < 168) speedScore = 10;

    const activityScore = Math.min(prs.length / 10, 1) * 30;

    return Math.max(0, Math.min(100, mergeRateScore + speedScore + activityScore));
  }

  calculateIssueHealth(issues: Issue[]): number {
    if (issues.length === 0) return 50;

    const closedIssues = issues.filter(i => i.state === 'closed');
    const resolutionRate = closedIssues.length / issues.length;
    const resolutionScore = resolutionRate * 50;

    let totalCloseHours = 0;
    closedIssues.forEach(i => {
      if (i.closedAt) {
        totalCloseHours += differenceInHours(new Date(i.closedAt), new Date(i.createdAt));
      }
    });
    const avgCloseHours = closedIssues.length > 0 ? totalCloseHours / closedIssues.length : 9999;

    let speedScore = 0;
    if (avgCloseHours < 48) speedScore = 30;
    else if (avgCloseHours < 168) speedScore = 20;
    else if (avgCloseHours < 720) speedScore = 10;

    const thirtyDaysAgo = subDays(new Date(), 30);
    const staleIssues = issues.filter(i => i.state === 'open' && isBefore(new Date(i.createdAt), thirtyDaysAgo));
    const stalePenalty = Math.min(staleIssues.length * 2, 20);

    return Math.max(0, Math.min(100, resolutionScore + speedScore - stalePenalty));
  }

  calculateCodeActivity(commits: Commit[], repo: Repository): number {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const last30DaysCommits = commits.filter(c => isAfter(new Date(c.committedAt), thirtyDaysAgo));
    
    const commitScore = Math.min(last30DaysCommits.length / 30, 1) * 50;

    const linesChanged = last30DaysCommits.reduce((sum, c) => sum + c.additions + c.deletions, 0);
    const linesScore = Math.min(linesChanged / 5000, 1) * 30;

    let recencyScore = 0;
    const sevenDaysAgo = subDays(new Date(), 7);
    const lastCommitAt = commits.length > 0 ? new Date(Math.max(...commits.map(c => new Date(c.committedAt).getTime()))) : null;
    
    if (lastCommitAt && isAfter(lastCommitAt, sevenDaysAgo)) recencyScore = 20;
    else if (lastCommitAt && isAfter(lastCommitAt, thirtyDaysAgo)) recencyScore = 10;

    return Math.max(0, Math.min(100, commitScore + linesScore + recencyScore));
  }

  calculateCommunityScore(repo: Repository, prs: PullRequest[], commits: Commit[]): number {
    const uniqueContributors = new Set(commits.map(c => c.authorLogin).filter(Boolean)).size;
    const contributorScore = Math.min(uniqueContributors / 5, 1) * 40;

    const hasDescription = repo.description ? 10 : 0;

    const prContributors = new Set(prs.map(p => p.authorLogin).filter(Boolean)).size;
    const diversityScore = Math.min(prContributors / 3, 1) * 30;

    let recentActivity = 0;
    const sevenDaysAgo = subDays(new Date(), 7);
    const thirtyDaysAgo = subDays(new Date(), 30);
    
    const hasRecentCommit = commits.some(c => isAfter(new Date(c.committedAt), sevenDaysAgo));
    const hasRecentPR = prs.some(p => isAfter(new Date(p.createdAt), sevenDaysAgo));
    
    if (hasRecentCommit || hasRecentPR) recentActivity = 20;
    else {
      const hasSemiRecentCommit = commits.some(c => isAfter(new Date(c.committedAt), thirtyDaysAgo));
      const hasSemiRecentPR = prs.some(p => isAfter(new Date(p.createdAt), thirtyDaysAgo));
      if (hasSemiRecentCommit || hasSemiRecentPR) recentActivity = 10;
    }

    return Math.max(0, Math.min(100, contributorScore + hasDescription + diversityScore + recentActivity));
  }

  calculateOverallScore(scores: CategoryScores): number {
    return (
      scores.commitConsistency * 0.25 +
      scores.prHealthScore * 0.25 +
      scores.issueHealthScore * 0.2 +
      scores.codeActivityScore * 0.2 +
      scores.communityScore * 0.1
    );
  }

  gradeFromScore(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  generateScoreInsights(scores: CategoryScores, commits: Commit[], prs: PullRequest[], issues: Issue[]): string[] {
    const insights: string[] = [];
    
    // Consistency
    if (scores.commitConsistency > 80) {
      insights.push('Commit activity is strong and highly consistent over the last 90 days.');
    } else if (scores.commitConsistency < 40) {
      insights.push('Commit activity has been sparse or inconsistent recently.');
    }

    // PRs
    const mergedPRs = prs.filter(p => p.state === 'merged');
    if (mergedPRs.length > 0) {
      const totalHours = mergedPRs.reduce((sum, p) => sum + differenceInHours(new Date(p.mergedAt!), new Date(p.createdAt)), 0);
      const avgMergeHours = totalHours / mergedPRs.length;
      if (avgMergeHours < 24) {
        insights.push(`PRs are merged quickly — average merge time is ${avgMergeHours.toFixed(1)} hours.`);
      }
    }

    // Issues
    const openIssues = issues.filter(i => i.state === 'open');
    const thirtyDaysAgo = subDays(new Date(), 30);
    const staleIssues = openIssues.filter(i => isBefore(new Date(i.createdAt), thirtyDaysAgo));
    if (staleIssues.length > 0) {
      insights.push(`${staleIssues.length} issues have been open for over 30 days, dragging down the issue score.`);
    }

    // Community
    const uniqueContributors = new Set(commits.map(c => c.authorLogin).filter(Boolean)).size;
    if (uniqueContributors === 1) {
      insights.push('Only 1 contributor has made commits in the last 90 days.');
    } else if (uniqueContributors > 5) {
      insights.push(`Strong collaborative environment with ${uniqueContributors} active contributors.`);
    }

    // Recency
    const fourteenDaysAgo = subDays(new Date(), 14);
    const hasRecentCommit = commits.some(c => isAfter(new Date(c.committedAt), fourteenDaysAgo));
    if (!hasRecentCommit) {
      insights.push('No commits in the last 14 days — consider reviewing activity.');
    }

    return insights.slice(0, 5);
  }
}
