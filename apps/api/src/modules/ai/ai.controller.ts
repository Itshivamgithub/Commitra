import { Request, Response } from 'express';
import { aiService } from './ai.service';
import { analyticsQueue } from '../../jobs/queues';
import { z } from 'zod';
import logger from '../../lib/logger';

const generateSchema = z.object({
  types: z.array(z.enum(['summary', 'activity', 'recommendations'])).min(1).max(3),
});

export class AIController {
  generate = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const userId = (req.user as any).id;
    const { types } = generateSchema.parse(req.body);

    logger.info({ repoId, userId, types }, 'Triggering AI insights generation');

    const job = await analyticsQueue.add('generate-insights', {
      repositoryId: repoId,
      userId,
      insightTypes: types,
    });

    return res.json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
      },
    });
  };

  getInsights = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const data = await aiService.getInsights(repoId);
    return res.json({ success: true, data });
  };
}

export const aiController = new AIController();
export default aiController;
