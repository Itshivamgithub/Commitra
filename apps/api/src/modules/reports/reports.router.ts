import { Router } from 'express';
import { reportsController } from './reports.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';

const router = Router();

router.use(requireAuth);

router.get('/:repoId/pdf', tryCatch(reportsController.generatePDF));

export default router;
