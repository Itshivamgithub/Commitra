import { prisma } from '../../../lib/prisma';
import logger from '../../../lib/logger';
import { createGithubClient } from '../../../lib/github';

export async function syncIssues(
  repoFullName: string,
  githubToken: string,
  repositoryId: string
) {
  const github = createGithubClient(githubToken);
  let page = 1;
  let hasNextPage = true;
  let totalSynced = 0;

  logger.info({ repoFullName, repositoryId }, 'Starting issue sync');

  try {
    while (hasNextPage) {
      const response = await github.get(`/repos/${repoFullName}/issues`, {
        params: {
          state: 'all',
          per_page: 100,
          sort: 'updated',
          filter: 'all',
          page,
        },
      });

      const rawIssues = response.data;
      if (!Array.isArray(rawIssues) || rawIssues.length === 0) {
        hasNextPage = false;
        break;
      }

      const issuesToStore = [];

      for (const raw of rawIssues) {
        // Skip Pull Requests (GitHub Issues API returns both)
        if (raw.pull_request) continue;

        // Only sync issues updated in the last 90 days
        const updatedAt = new Date(raw.updated_at);
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        
        if (updatedAt < ninetyDaysAgo) {
          hasNextPage = false;
          break;
        }

        issuesToStore.push({
          githubId: raw.id,
          repositoryId,
          number: raw.number,
          title: raw.title,
          state: raw.state, // open | closed
          authorLogin: raw.user?.login || null,
          labels: raw.labels.map((l: any) => l.name),
          createdAt: new Date(raw.created_at),
          closedAt: raw.closed_at ? new Date(raw.closed_at) : null,
        });
      }

      if (issuesToStore.length > 0) {
        await prisma.issue.createMany({
          data: issuesToStore,
          skipDuplicates: true,
        });
        totalSynced += issuesToStore.length;
      }

      const linkHeader = response.headers['link'];
      if (linkHeader && linkHeader.includes('rel="next"') && hasNextPage) {
        page++;
      } else {
        hasNextPage = false;
      }
    }

    logger.info({ repoFullName, totalSynced }, 'Completed issue sync');
    return totalSynced;
  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.warn({ repoFullName }, 'Repo not found, skipping issue sync');
      return 0;
    }
    throw error;
  }
}
