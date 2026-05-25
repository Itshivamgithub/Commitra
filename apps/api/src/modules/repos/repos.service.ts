import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/crypto';
import { createGithubClient } from '../../lib/github';
import logger from '../../lib/logger';
import { User, Repository } from '@prisma/client';

export class ReposService {
  /**
   * Helper function to parse next page URL from GitHub API Link header
   */
  private parseNextPageUrl(linkHeader: string | undefined): string | null {
    if (!linkHeader) return null;
    const links = linkHeader.split(',');
    for (const link of links) {
      const parts = link.split(';');
      if (parts.length >= 2 && parts[1].includes('rel="next"')) {
        const match = parts[0].trim().match(/^<([^>]+)>$/);
        if (match) return match[1];
      }
    }
    return null;
  }

  /**
   * Syncs all user repositories from the GitHub API and stores/upserts them in the DB
   */
  async syncUserRepos(user: User): Promise<{ synced: number; repositories: Repository[] }> {
    try {
      // 1. Decrypt GitHub access token
      const githubToken = decrypt(user.githubTokenEnc);
      const client = createGithubClient(githubToken);

      let url: string | null = '/user/repos?per_page=100&sort=updated&type=all';
      const allGithubRepos: any[] = [];

      // 2. Fetch all pages of repositories (follow next links in pagination header)
      while (url) {
        logger.info(`Fetching GitHub repositories page: ${url}`);
        const response = await client.get(url);
        
        if (Array.isArray(response.data)) {
          allGithubRepos.push(...response.data);
        }

        // Check if there is a next page
        const linkHeader = response.headers['link'];
        const nextPage = this.parseNextPageUrl(linkHeader);
        
        // If nextPage contains full url, extract path/query or set directly if baseURL is used
        if (nextPage) {
          // GitHub API returns absolute URLs. If it starts with baseURL, keep just relative part or let axios handle it
          const baseURL = 'https://api.github.com';
          if (nextPage.startsWith(baseURL)) {
            url = nextPage.slice(baseURL.length);
          } else {
            url = nextPage;
          }
        } else {
          url = null;
        }
      }

      logger.info(`Fetched ${allGithubRepos.length} repositories from GitHub for user ${user.username}`);

      // DEBUG: Log first repo stars/forks
      if (allGithubRepos.length > 0) {
        logger.info({ 
          name: allGithubRepos[0].name, 
          stars: allGithubRepos[0].stargazers_count, 
          forks: allGithubRepos[0].forks_count 
        }, 'First repository metadata from GitHub');
      }

      // 3. Map GitHub repos to Prisma models
      const mappedRepos = allGithubRepos.map((repo) => ({
        githubId: repo.id,
        userId: user.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || null,
        language: repo.language || null,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        isPrivate: repo.private,
        isArchived: repo.archived,
        defaultBranch: repo.default_branch || 'main',
        githubUrl: repo.html_url,
        lastPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        githubCreatedAt: repo.created_at ? new Date(repo.created_at) : null,
        syncedAt: new Date(),
      }));

      // 4. Batch upsert using a Prisma transaction to ensure efficiency
      const upserts = mappedRepos.map((repo) =>
        prisma.repository.upsert({
          where: { githubId: repo.githubId },
          update: {
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description,
            language: repo.language,
            stars: repo.stars,
            forks: repo.forks,
            isPrivate: repo.isPrivate,
            isArchived: repo.isArchived,
            defaultBranch: repo.defaultBranch,
            githubUrl: repo.githubUrl,
            lastPushedAt: repo.lastPushedAt,
            githubCreatedAt: repo.githubCreatedAt,
            syncedAt: repo.syncedAt,
          },
          create: repo,
        })
      );

      const results = await prisma.$transaction(upserts);

      // 5. Enqueue background sync for each repository to populate analytics
      // We only do this for the first 10 to avoid overwhelming the queue immediately
      // The rest will be picked up by the nightly sync or manual triggers
      for (const repo of results.slice(0, 15)) {
        const { syncQueue } = await import('../../jobs/queues');
        await syncQueue.add('sync-repo', {
          repositoryId: repo.id,
          repoFullName: repo.fullName,
          userId: user.id,
          triggeredBy: 'initial_sync',
        });
      }

      return {
        synced: results.length,
        repositories: results,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, `Failed syncing repositories for user ${user.username}`);
      throw error;
    }
  }

  /**
   * Returns all repositories for a user from database with optional filtering and sorting
   */
  async getUserRepos(
    userId: string,
    filters: { language?: string; sort?: string; order?: string }
  ): Promise<Repository[]> {
    const where: any = { userId };

    if (filters.language) {
      where.language = filters.language;
    }

    const orderBy: any = {};
    const validSortFields = ['stars', 'forks', 'name', 'lastPushedAt', 'createdAt', 'syncedAt'];
    const sortField = validSortFields.includes(filters.sort || '') ? filters.sort! : 'lastPushedAt';
    const orderDir = ['asc', 'desc'].includes(filters.order || '') ? filters.order! : 'desc';

    orderBy[sortField] = orderDir;

    const repos = await prisma.repository.findMany({
      where,
      orderBy,
    });

    logger.info({ userId, count: repos.length }, 'Fetched repositories from database in service');
    return repos;
  }

  /**
   * Retrieves detail of a single repository owned by user
   */
  async getRepoById(userId: string, repoId: string): Promise<Repository | null> {
    return prisma.repository.findFirst({
      where: {
        id: repoId,
        userId,
      },
    });
  }
}

export const reposService = new ReposService();
export default reposService;
