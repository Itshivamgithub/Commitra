import { Router } from 'express';
import { webhooksController } from './webhooks.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';
import { webhookLimiter } from '../../middleware/rateLimiter';
import express from 'express';

const router = Router();

/**
 * GitHub Webhook Receiver
 * This must use the raw body parser for signature verification
 */
router.post(
  '/github',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  tryCatch(webhooksController.verifyGithubSignature),
  tryCatch(webhooksController.receiver)
);

/**
 * Management Endpoints (Auth Required)
 */
router.use(requireAuth);

router.post('/:repoId/register', tryCatch(webhooksController.register));
router.delete('/:repoId', tryCatch(webhooksController.delete));
router.get('/:repoId/status', tryCatch(webhooksController.getStatus));

export default router;
