import { prisma } from '../../../lib/prisma';
import logger from '../../../lib/logger';
import { createGithubClient } from '../../../lib/github';
import { subDays } from 'date-fns';

export async function syncWorkflows(
  repoFullName: string,
  githubToken: string,
  repositoryId: string
) {
  const client = createGithubClient(githubToken);
  let totalSynced = 0;
  
  // Use a 90 day cutoff
  const since = subDays(new Date(), 90).toISOString();

  try {
    const { data } = await client.get(`/repos/${repoFullName}/actions/runs`, {
      params: {
        per_page: 100,
        created: `>=${since}`
      }
    });

    const runs = data.workflow_runs || [];
    
    if (runs.length === 0) {
      return 0;
    }

    const upserts = runs.map((run: any) => {
      const startedAt = new Date(run.created_at);
      const completedAt = run.updated_at ? new Date(run.updated_at) : null;
      let durationSeconds = null;

      if (completedAt && startedAt) {
        durationSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);
      }

      return prisma.workflowRun.upsert({
        where: { githubRunId: run.id },
        update: {
          status: run.status,
          conclusion: run.conclusion,
          completedAt,
          durationSeconds,
          syncedAt: new Date()
        },
        create: {
          githubRunId: run.id,
          repositoryId,
          workflowName: run.name || 'Unknown',
          workflowFile: run.path || 'Unknown',
          branch: run.head_branch || 'Unknown',
          event: run.event || 'Unknown',
          status: run.status || 'Unknown',
          conclusion: run.conclusion,
          startedAt,
          completedAt,
          durationSeconds,
          triggeredBy: run.actor?.login,
          commitSha: run.head_sha
        }
      });
    });

    // Execute in batches to avoid overwhelming the DB
    const BATCH_SIZE = 50;
    for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
      await prisma.$transaction(upserts.slice(i, i + BATCH_SIZE));
    }

    totalSynced = runs.length;
    logger.info({ repoFullName, count: totalSynced }, 'Completed workflow sync');
    return totalSynced;

  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.info({ repoFullName }, 'GitHub Actions not enabled for repo, skipping workflow sync');
      return 0;
    }
    // Rate limit or other error
    logger.error({ repoFullName, error: error.message }, 'Failed to sync workflows');
    throw error;
  }
}
