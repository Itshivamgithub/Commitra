import { Router } from 'express';
import { aiController } from './ai.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';
import { aiLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.use(requireAuth);

router.post('/:repoId/generate', aiLimiter, tryCatch(aiController.generate));
router.get('/:repoId/insights', tryCatch(aiController.getInsights));

export default router;
