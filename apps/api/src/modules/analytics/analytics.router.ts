import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';
import { syncLimiter } from '../../middleware/rateLimiter';

const router = Router();

// All analytics routes require authentication
router.use(requireAuth);

router.get('/compare', tryCatch(analyticsController.compare));

router.post('/:repoId/sync', syncLimiter, tryCatch(analyticsController.sync));
router.get('/:repoId/sync/status', tryCatch(analyticsController.getStatus));
router.get('/:repoId/overview', tryCatch(analyticsController.getOverview));
router.get('/:repoId/health', tryCatch(analyticsController.getHealth));
router.get('/:repoId/commits', tryCatch(analyticsController.getCommits));
router.get('/:repoId/commits/list', tryCatch(analyticsController.getCommitsList));
router.get('/:repoId/contributors', tryCatch(analyticsController.getContributors));
router.get('/:repoId/pullrequests', tryCatch(analyticsController.getPullRequests));
router.get('/:repoId/issues', tryCatch(analyticsController.getIssues));
router.get('/:repoId/cicd', tryCatch(analyticsController.getCicd));

export default router;
