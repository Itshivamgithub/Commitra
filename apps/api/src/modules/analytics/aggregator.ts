import { prisma } from '../../lib/prisma';
import logger from '../../lib/logger';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';

export async function aggregateAnalytics(repositoryId: string) {
  logger.info({ repositoryId }, 'Starting analytics aggregation');

  const ninetyDaysAgo = startOfDay(subDays(new Date(), 90));
  const today = startOfDay(new Date());

  // Fetch all data for the last 90 days
  const [commits, prs, issues] = await Promise.all([
    prisma.commit.findMany({
      where: {
        repositoryId,
        committedAt: { gte: ninetyDaysAgo },
      },
    }),
    prisma.pullRequest.findMany({
      where: {
        repositoryId,
        createdAt: { gte: ninetyDaysAgo },
      },
    }),
    prisma.issue.findMany({
      where: {
        repositoryId,
        createdAt: { gte: ninetyDaysAgo },
      },
    }),
  ]);

  // Group by day
  const days = eachDayOfInterval({ start: ninetyDaysAgo, end: today });
  const snapshots = [];

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const dayCommits = commits.filter(
      (c) => c.committedAt >= dayStart && c.committedAt <= dayEnd
    );
    const dayPRsOpened = prs.filter(
      (p) => p.createdAt >= dayStart && p.createdAt <= dayEnd
    );
    const dayPRsMerged = prs.filter(
      (p) => p.mergedAt && p.mergedAt >= dayStart && p.mergedAt <= dayEnd
    );
    const dayIssuesOpened = issues.filter(
      (i) => i.createdAt >= dayStart && i.createdAt <= dayEnd
    );
    const dayIssuesClosed = issues.filter(
      (i) => i.closedAt && i.closedAt >= dayStart && i.closedAt <= dayEnd
    );

    const activeContributors = new Set(dayCommits.map((c) => c.authorLogin).filter(Boolean));
    
    const additions = dayCommits.reduce((sum, c) => sum + c.additions, 0);
    const deletions = dayCommits.reduce((sum, c) => sum + c.deletions, 0);

    snapshots.push({
      repositoryId,
      snapshotDate: dayStart,
      commitCount: dayCommits.length,
      prOpened: dayPRsOpened.length,
      prMerged: dayPRsMerged.length,
      issuesOpened: dayIssuesOpened.length,
      issuesClosed: dayIssuesClosed.length,
      activeContributors: activeContributors.size,
      additions,
      deletions,
    });
  }

  // Use a transaction for upserts
  await prisma.$transaction(
    snapshots.map((snapshot) =>
      prisma.analyticsSnapshot.upsert({
        where: {
          repositoryId_snapshotDate: {
            repositoryId: snapshot.repositoryId,
            snapshotDate: snapshot.snapshotDate,
          },
        },
        update: snapshot,
        create: snapshot,
      })
    )
  );

  logger.info({ repositoryId, snapshotCount: snapshots.length }, 'Completed analytics aggregation');
}
