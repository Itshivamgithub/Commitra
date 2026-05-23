import { Router } from 'express';
import { reposController } from './repos.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';

const router = Router();

// Apply auth middleware to all repository endpoints
router.use(tryCatch(requireAuth));

// Sync user repositories
router.post('/sync', tryCatch(reposController.syncRepos));

// List user repositories
router.get('/', tryCatch(reposController.getRepos));

// Retrieve detail of a single repository
router.get('/:repoId', tryCatch(reposController.getRepoDetail));

export default router;
