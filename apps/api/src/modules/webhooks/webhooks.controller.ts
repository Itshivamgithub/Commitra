import { Request, Response, NextFunction } from 'express';
import { webhooksService } from './webhooks.service';
import { decrypt } from '../../lib/crypto';
import { syncQueue } from '../../jobs/queues';
import { emitWebhookReceived } from '../../lib/emit';
import { redis } from '../../lib/redis';
import { prisma } from '../../lib/prisma';
import logger from '../../lib/logger';
import crypto from 'crypto';

export class WebhooksController {
  /**
   * Verify signature from GitHub
   */
  verifyGithubSignature = async (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    
    if (!signature) {
      logger.warn('Webhook received without signature');
      return res.status(401).json({ success: false, error: 'No signature' });
    }

    try {
      // 1. Extract repository full name from payload before parsing if possible
      // Actually, we need to parse it or peek into it.
      // Since it's raw body, we can parse it once here.
      const payload = JSON.parse(req.body.toString());
      const repoFullName = payload.repository?.full_name;

      if (!repoFullName) {
        logger.warn('Webhook received without repository info');
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }

      // 2. Get secret from DB
      const webhook = await webhooksService.getWebhookByRepoFullName(repoFullName);
      if (!webhook) {
        logger.warn({ repoFullName }, 'Webhook received for unknown repository');
        return res.status(404).json({ success: false, error: 'Webhook not found' });
      }

      const decryptedSecret = decrypt(webhook.secret);

      // 3. Compute HMAC
      const hmac = crypto.createHmac('sha256', decryptedSecret);
      const computed = 'sha256=' + hmac.update(req.body).digest('hex');

      // 4. Compare
      if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))) {
        logger.warn({ repoFullName }, 'Webhook signature mismatch');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }

      // Store repo info in request for next handler
      (req as any).webhookRepo = webhook.repository;
      (req as any).webhookPayload = payload;
      
      next();
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error verifying GitHub signature');
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /**
   * Receiver endpoint for GitHub events
   */
  receiver = async (req: Request, res: Response) => {
    const event = req.headers['x-github-event'] as string;
    const repo = (req as any).webhookRepo;
    const payload = (req as any).webhookPayload;

    logger.info({ event, repo: repo.fullName }, 'GitHub webhook event received');

    if (event === 'ping') {
      return res.status(200).json({ ok: true });
    }

    // Rate limiting for webhooks
    const cooldownKey = `webhook:cooldown:${repo.id}`;
    const onCooldown = await redis.get(cooldownKey);
    if (onCooldown) {
      logger.info({ repoId: repo.id }, 'Webhook job skipped due to cooldown');
      return res.status(200).json({ success: true, message: 'Skipped: Cooldown' });
    }

    let shouldSync = false;
    let message = '';

    if (event === 'push') {
      if (payload.ref === `refs/heads/${repo.defaultBranch}`) {
        shouldSync = true;
        message = `${payload.commits?.length || 0} new commits pushed by ${payload.pusher?.login || 'someone'}`;
      }
    } else if (event === 'pull_request') {
      const actions = ['opened', 'closed', 'merged'];
      if (actions.includes(payload.action)) {
        shouldSync = true;
        message = `PR #${payload.number} ${payload.action}: "${payload.pull_request?.title}"`;
      }
    } else if (event === 'issues') {
      const actions = ['opened', 'closed', 'reopened'];
      if (actions.includes(payload.action)) {
        shouldSync = true;
        message = `Issue #${payload.number} ${payload.action}: "${payload.issue?.title}"`;
      }
    }

    if (shouldSync) {
      // Update lastWebhookAt
      await prisma.repository.update({
        where: { id: repo.id },
        data: { lastWebhookAt: new Date() }
      });

      // Enqueue job
      await syncQueue.add('sync-repo', {
        repositoryId: repo.id,
        repoFullName: repo.fullName,
        userId: repo.userId,
        triggeredBy: 'webhook',
      });

      // Set cooldown
      await redis.set(cooldownKey, '1', 'EX', 60);

      // Emit socket event
      emitWebhookReceived(repo.userId, repo.id, event, message);
      
      // Also emit a notification
      // Wait, NotificationService will be added in Task 4.
      // I'll add the notification call later or just use emitNotification helper which I already added.
      const { emitNotification } = await import('../../lib/emit');
      emitNotification(repo.userId, 'info', 'Auto-sync triggered', message, repo.id);
    }

    return res.status(200).json({ success: true });
  };

  /**
   * Register a new webhook
   */
  register = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const userId = (req.user as any).id;

    try {
      const result = await webhooksService.registerWebhook(repoId, userId);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * Delete a webhook
   */
  delete = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const userId = (req.user as any).id;

    try {
      const result = await webhooksService.deleteWebhook(repoId, userId);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * Get webhook status for a repo
   */
  getStatus = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const userId = (req.user as any).id;

    try {
      const result = await webhooksService.getWebhookStatus(repoId, userId);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  };
}

export const webhooksController = new WebhooksController();
export default webhooksController;
