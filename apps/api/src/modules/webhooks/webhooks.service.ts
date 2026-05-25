import { prisma } from '../../lib/prisma';
import { decrypt, encrypt } from '../../lib/crypto';
import { createGithubClient } from '../../lib/github';
import logger from '../../lib/logger';
import crypto from 'crypto';

export class WebhooksService {
  async registerWebhook(repoId: string, userId: string) {
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, userId },
      include: { user: true }
    });

    if (!repo) {
      throw new Error('Repository not found');
    }

    const githubToken = decrypt(repo.user.githubTokenEnc);
    const client = createGithubClient(githubToken);

    const secret = crypto.randomBytes(32).toString('hex');
    const encryptedSecret = encrypt(secret);

    try {
      const response = await client.post(`/repos/${repo.fullName}/hooks`, {
        name: 'web',
        active: true,
        events: ['push', 'pull_request', 'issues'],
        config: {
          url: `${process.env.WEBHOOK_BASE_URL || process.env.API_URL}/api/webhooks/github`,
          content_type: 'json',
          secret: secret,
          insecure_ssl: '0'
        }
      });

      const githubHookId = response.data.id;

      await prisma.webhook.upsert({
        where: { repositoryId: repoId },
        update: {
          githubHookId,
          secret: encryptedSecret,
          active: true,
          events: ['push', 'pull_request', 'issues']
        },
        create: {
          repositoryId: repoId,
          githubHookId,
          secret: encryptedSecret,
          active: true,
          events: ['push', 'pull_request', 'issues']
        }
      });

      await prisma.repository.update({
        where: { id: repoId },
        data: { webhookEnabled: true }
      });

      logger.info({ repoId, githubHookId }, 'Webhook registered on GitHub');
      return { success: true, hookId: githubHookId };
    } catch (error: any) {
      logger.error({ repoId, error: error.message, details: error.response?.data }, 'Failed to register webhook on GitHub');
      throw new Error(error.response?.data?.message || 'Failed to register webhook');
    }
  }

  async deleteWebhook(repoId: string, userId: string) {
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, userId },
      include: { webhook: true, user: true }
    });

    if (!repo || !repo.webhook) {
      throw new Error('Webhook not found');
    }

    const githubToken = decrypt(repo.user.githubTokenEnc);
    const client = createGithubClient(githubToken);

    try {
      await client.delete(`/repos/${repo.fullName}/hooks/${repo.webhook.githubHookId}`);
      
      await prisma.webhook.delete({
        where: { repositoryId: repoId }
      });

      await prisma.repository.update({
        where: { id: repoId },
        data: { webhookEnabled: false }
      });

      logger.info({ repoId }, 'Webhook deleted from GitHub');
      return { success: true };
    } catch (error: any) {
      logger.error({ repoId, error: error.message }, 'Failed to delete webhook from GitHub');
      // Even if GitHub fails (e.g. hook already deleted), we should clean up our DB
      if (error.response?.status === 404) {
        await prisma.webhook.delete({ where: { repositoryId: repoId } }).catch(() => {});
        await prisma.repository.update({ where: { id: repoId }, data: { webhookEnabled: false } }).catch(() => {});
        return { success: true };
      }
      throw new Error(error.response?.data?.message || 'Failed to delete webhook');
    }
  }

  async getWebhookStatus(repoId: string, userId: string) {
    const webhook = await prisma.webhook.findUnique({
      where: { repositoryId: repoId },
      include: { repository: true }
    });

    if (!webhook || webhook.repository.userId !== userId) {
      return {
        enabled: false,
        hookId: null,
        events: [],
        createdAt: null
      };
    }

    return {
      enabled: webhook.active,
      hookId: webhook.githubHookId,
      events: webhook.events,
      createdAt: webhook.createdAt
    };
  }

  async getWebhookByRepoFullName(fullName: string) {
    return prisma.webhook.findFirst({
      where: { repository: { fullName } },
      include: { repository: true }
    });
  }
}

export const webhooksService = new WebhooksService();
export default webhooksService;
