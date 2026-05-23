import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { encrypt } from '../../lib/crypto';
import { createGithubClient } from '../../lib/github';
import logger from '../../lib/logger';

export class AuthService {
  /**
   * Generates the GitHub OAuth authorization URL
   */
  getGithubAuthUrl(): string {
    const rootUrl = 'https://github.com/login/oauth/authorize';
    const options = {
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.GITHUB_CALLBACK_URL,
      scope: 'read:user user:email repo',
      state: crypto.randomBytes(16).toString('hex'),
    };
    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  /**
   * Exchanges authorization code for a GitHub access token
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.GITHUB_CALLBACK_URL,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (response.data.error) {
        logger.error({ error: response.data }, 'GitHub OAuth token exchange failed');
        throw new Error(response.data.error_description || 'OAuth token exchange failed');
      }

      return response.data.access_token;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to exchange OAuth code');
      throw new Error(error.message || 'Failed to exchange OAuth code');
    }
  }

  /**
   * Fetches GitHub user profile
   */
  async fetchGithubProfile(token: string) {
    const client = createGithubClient(token);
    const { data } = await client.get('/user');
    return {
      githubId: String(data.id),
      username: data.login,
      displayName: data.name || null,
      avatarUrl: data.avatar_url || null,
    };
  }

  /**
   * Fetches GitHub user primary email
   */
  async fetchGithubPrimaryEmail(token: string): Promise<string | null> {
    try {
      const client = createGithubClient(token);
      const { data } = await client.get('/user/emails');
      
      interface GithubEmail {
        email: string;
        primary: boolean;
        verified: boolean;
      }
      
      const primaryEmail = (data as GithubEmail[]).find((email) => email.primary && email.verified);
      return primaryEmail ? primaryEmail.email : ((data as GithubEmail[])[0]?.email || null);
    } catch (error) {
      logger.warn('Could not fetch email from GitHub, continuing without email');
      return null;
    }
  }

  /**
   * Upserts the user record in PostgreSQL and encrypts their GitHub access token
   */
  async upsertUser(profile: {
    githubId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    email: string | null;
  }, githubToken: string) {
    const encryptedToken = encrypt(githubToken);

    return prisma.user.upsert({
      where: { githubId: profile.githubId },
      update: {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        email: profile.email,
        githubTokenEnc: encryptedToken,
      },
      create: {
        githubId: profile.githubId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        email: profile.email,
        githubTokenEnc: encryptedToken,
      },
    });
  }

  /**
   * Generates JWT Access Token and a Refresh Token stored in DB
   */
  async generateTokens(userId: string) {
    const accessToken = jwt.sign({ userId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const refreshTokenString = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: refreshTokenString,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
      expiresAt,
    };
  }

  /**
   * Validates refresh token and returns corresponding user
   */
  async validateRefreshToken(token: string) {
    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!refreshTokenRecord) {
      return null;
    }

    if (refreshTokenRecord.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.refreshToken.delete({ where: { id: refreshTokenRecord.id } }).catch(() => {});
      return null;
    }

    return refreshTokenRecord.user;
  }

  /**
   * Deletes a refresh token from database
   */
  async deleteRefreshToken(token: string) {
    try {
      await prisma.refreshToken.delete({
        where: { token },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const authService = new AuthService();
export default authService;
