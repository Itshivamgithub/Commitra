import { Resend } from 'resend';
import { env } from '../config/env';
import logger from './logger';

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
    } else {
      logger.warn('RESEND_API_KEY not provided. Emails will not be sent.');
    }
  }

  async sendWorkspaceInvite(params: {
    to: string;
    inviterName: string;
    workspaceName: string;
    role: string;
    inviteUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.resend) {
      logger.info({ params }, 'Mock sendWorkspaceInvite (Resend disabled)');
      return;
    }

    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; margin-bottom: 24px;">Commitra</h2>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
          <strong>${params.inviterName}</strong> has invited you to join <strong>${params.workspaceName}</strong> as a ${params.role}.
        </p>
        <div style="margin: 32px 0;">
          <a href="${params.inviteUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            Accept invitation
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This invite expires on ${params.expiresAt.toLocaleDateString()}.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    `;

    try {
      await this.resend.emails.send({
        from: env.RESEND_FROM_EMAIL || 'noreply@commitra.app',
        to: params.to,
        subject: `${params.inviterName} invited you to ${params.workspaceName} on Commitra`,
        html,
      });
      logger.info({ to: params.to, workspace: params.workspaceName }, 'Sent workspace invite email');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to send workspace invite email');
      throw new Error('Failed to send invite email');
    }
  }
}

export const emailService = new EmailService();
export default emailService;
