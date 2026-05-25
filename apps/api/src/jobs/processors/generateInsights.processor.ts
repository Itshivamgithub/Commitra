import { Job } from 'bullmq';
import { aiService } from '../../modules/ai/ai.service';
import logger from '../../lib/logger';
import { GenerateInsightsJobData } from '@commitra/types';
import { emitInsightsReady } from '../../lib/emit';

export const generateInsightsProcessor = async (job: Job<GenerateInsightsJobData>) => {
  const { repositoryId, userId, insightTypes } = job.data;

  logger.info({ repositoryId, insightTypes }, 'Generating AI insights');

  try {
    await aiService.generateInsights(repositoryId, userId, insightTypes);
    
    // Emit socket event
    emitInsightsReady(userId, repositoryId, insightTypes);

    logger.info({ repositoryId }, 'AI insights generated successfully');
  } catch (error: any) {
    logger.error({ repositoryId, error: error.message }, 'Failed to generate AI insights');
    throw error;
  }
};
