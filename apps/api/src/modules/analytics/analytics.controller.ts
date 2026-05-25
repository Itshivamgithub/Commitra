import { Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { z } from 'zod';
import logger from '../../lib/logger';
import { syncQueue } from '../../jobs/queues';

const rangeSchema = z.enum(['7d', '30d', '90d']).default('30d');

export class AnalyticsController {
  sync = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { repoId } = req.params;
    const userId = (req.user as any).id;

    logger.info({ repoId, userId }, 'Triggering manual analytics sync');
    
    const repo = await analyticsService.getRepoById(userId, repoId);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    const job = await syncQueue.add('sync-repo', {
      repositoryId: repoId,
      repoFullName: repo.fullName,
      userId,
      triggeredBy: 'manual',
    });

    return res.json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
      },
    });
  };

  getStatus = async (req: Request, res: Response) => {
    const { jobId } = req.query;
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ success: false, error: 'jobId is required' });
    }

    const job = await syncQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const state = await job.getState();
    
    return res.json({
      success: true,
      data: {
        jobId: job.id,
        status: state,
        progress: job.progress,
        failedReason: job.failedReason,
        completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
      },
    });
  };

  getOverview = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const data = await analyticsService.getOverview(repoId);
    return res.json({ success: true, data });
  };

  getCommits = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const range = rangeSchema.parse(req.query.range);
    const data = await analyticsService.getCommits(repoId, range);
    return res.json({ success: true, data });
  };

  getCommitsList = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const page = z.coerce.number().default(1).parse(req.query.page);
    const limit = z.coerce.number().default(20).parse(req.query.limit);
    const data = await analyticsService.getCommitsList(repoId, page, limit);
    return res.json({ success: true, data });
  };

  getContributors = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const data = await analyticsService.getContributors(repoId);
    return res.json({ success: true, data });
  };

  getPullRequests = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const range = rangeSchema.parse(req.query.range);
    const data = await analyticsService.getPullRequests(repoId, range);
    return res.json({ success: true, data });
  };

  getIssues = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const range = rangeSchema.parse(req.query.range);
    const data = await analyticsService.getIssues(repoId, range);
    return res.json({ success: true, data });
  };

  getHealth = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const data = await analyticsService.getHealth(repoId);
    return res.json({ success: true, data });
  };

  getCicd = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const range = (req.query.range as any) || '30d';
    const parsedRange = rangeSchema.parse(range);
    const data = await analyticsService.getCicd(repoId, parsedRange);
    return res.json({ success: true, data });
  };

  compare = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const reposRaw = req.query.repos as string;
    if (!reposRaw) {
      return res.status(400).json({ success: false, error: 'repos query parameter is required' });
    }
    
    const repoIds = reposRaw.split(',').map(r => r.trim()).slice(0, 4);
    if (repoIds.length < 2) {
      return res.status(400).json({ success: false, error: 'At least 2 repos are required for comparison' });
    }

    const data = await analyticsService.compareRepos(userId, repoIds);
    return res.json({ success: true, data });
  };
}

export const analyticsController = new AnalyticsController();

export default analyticsController;
