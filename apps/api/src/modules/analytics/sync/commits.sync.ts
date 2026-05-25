import { prisma } from '../../../lib/prisma';
import logger from '../../../lib/logger';
import { createGithubClient } from '../../../lib/github';
import { AxiosInstance } from 'axios';

export async function syncCommits(
  repoFullName: string,
  githubToken: string,
  repositoryId: string,
  defaultBranch: string = 'main'
) {
  const github = createGithubClient(githubToken);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  let page = 1;
  let hasNextPage = true;
  let totalSynced = 0;
  let detailFetchedCount = 0;

  logger.info({ repoFullName, repositoryId }, 'Starting commit sync');

  try {
    while (hasNextPage) {
      const response = await github.get(`/repos/${repoFullName}/commits`, {
        params: {
          since,
          per_page: 100,
          sha: defaultBranch,
          page,
        },
      });

      const rawCommits = response.data;
      if (!Array.isArray(rawCommits) || rawCommits.length === 0) {
        hasNextPage = false;
        break;
      }

      const commitsToStore = [];

      for (const raw of rawCommits) {
        let additions = 0;
        let deletions = 0;
        let changedFiles = 0;

        // Fetch details for first 200 commits to get stats
        if (detailFetchedCount < 200) {
          try {
            const detailResponse = await github.get(`/repos/${repoFullName}/commits/${raw.sha}`);
            additions = detailResponse.data.stats?.additions || 0;
            deletions = detailResponse.data.stats?.deletions || 0;
            changedFiles = detailResponse.data.files?.length || 0;
            detailFetchedCount++;
          } catch (error) {
            logger.warn({ sha: raw.sha, error }, 'Failed to fetch commit details');
          }
        }

        commitsToStore.push({
          sha: raw.sha,
          repositoryId,
          authorLogin: raw.author?.login || null,
          authorName: raw.commit.author?.name || null,
          authorEmail: raw.commit.author?.email || null,
          message: raw.commit.message.split('\n')[0].substring(0, 72),
          committedAt: new Date(raw.commit.author?.date || raw.commit.committer?.date),
          additions,
          deletions,
          changedFiles,
        });
      }

      await prisma.commit.createMany({
        data: commitsToStore,
        skipDuplicates: true,
      });

      totalSynced += commitsToStore.length;
      logger.info({ repoFullName, count: commitsToStore.length, totalSynced }, 'Batch of commits synced');

      const linkHeader = response.headers['link'];
      if (linkHeader && linkHeader.includes('rel="next"')) {
        page++;
      } else {
        hasNextPage = false;
      }
    }

    logger.info({ repoFullName, totalSynced }, 'Completed commit sync');
    return totalSynced;
  } catch (error: any) {
    if (error.response?.status === 409 || error.response?.status === 404) {
      logger.warn({ repoFullName, status: error.response.status }, 'Repo empty or not found, skipping commit sync');
      return 0;
    }
    throw error;
  }
}
