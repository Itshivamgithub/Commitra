import { Router } from 'express';
import { complexityController } from './complexity.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';

const router = Router();

router.use(requireAuth);

router.get('/:repoId', tryCatch(complexityController.getReport));

export default router;
