import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { env } from '../../config/env';
import logger from '../../lib/logger';

const isProd = env.NODE_ENV === 'production';

// Secure httpOnly cookie configurations
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 minutes
};

export class AuthController {
  /**
   * Redirects user to GitHub authorization page
   */
  githubLogin = (req: Request, res: Response) => {
    const url = authService.getGithubAuthUrl();
    res.redirect(url);
  };

  /**
   * Callback received from GitHub OAuth login
   */
  githubCallback = async (req: Request, res: Response) => {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      logger.error('No authorization code provided in GitHub callback');
      return res.redirect(`${env.WEB_URL}/login?error=no_code`);
    }

    try {
      // 1. Exchange code for GitHub token
      const githubToken = await authService.exchangeCodeForToken(code);

      // 2. Fetch GitHub User details and primary email
      const profileData = await authService.fetchGithubProfile(githubToken);
      const primaryEmail = await authService.fetchGithubPrimaryEmail(githubToken);
      const profile = { ...profileData, email: primaryEmail };

      // 3. Upsert user in PostgreSQL
      const user = await authService.upsertUser(profile, githubToken);

      // 4. Generate system access/refresh tokens
      const { accessToken, refreshToken } = await authService.generateTokens(user.id);

      // 5. Save httpOnly cookies for security
      res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
      res.cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);

      // 6. Redirect to frontend callback page with the in-memory access token
      res.redirect(`${env.WEB_URL}/callback?token=${accessToken}`);
    } catch (error: any) {
      logger.error(
        { 
          error: error.message, 
          stack: error.stack,
          details: error.response?.data || error.data || 'No extra details'
        }, 
        'GitHub authentication callback failed'
      );
      res.redirect(`${env.WEB_URL}/login?error=auth_failed`);
    }
  };

  /**
   * Refreshes the short-lived JWT access token
   */
  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token || typeof token !== 'string') {
      logger.warn({ hasCookies: !!req.cookies, cookieNames: req.cookies ? Object.keys(req.cookies) : [] }, 'Refresh failed: No token provided');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No refresh token provided',
      });
    }

    try {
      const user = await authService.validateRefreshToken(token);
      if (!user) {
        logger.warn({ token: token.substring(0, 10) + '...' }, 'Refresh failed: Invalid or expired token');
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or expired refresh token',
        });
      }

      // Generate new tokens
      const { accessToken, refreshToken } = await authService.generateTokens(user.id);

      // Delete old refresh token from DB if we want to rotate (validated inside validateRefreshToken or keep it)
      // For simple and secure rotation, let's delete the old one
      await authService.deleteRefreshToken(token).catch(() => {});

      // Set new cookies
      res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
      res.cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);

      return res.json({
        success: true,
        data: {
          accessToken,
          user: {
            id: user.id,
            githubId: user.githubId,
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Refresh token exchange failed');
      return res.status(500).json({
        success: false,
        error: 'Internal server error during token refresh',
      });
    }
  };

  /**
   * Logs out the user by clearing refresh tokens and cookies
   */
  logout = async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (token && typeof token === 'string') {
      await authService.deleteRefreshToken(token).catch(() => {});
    }

    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('accessToken', { path: '/' });

    return res.json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  };

  /**
   * Gets current authenticated user details
   */
  getMe = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { githubTokenEnc, ...safeUser } = req.user as any;

    return res.json({
      success: true,
      data: {
        user: safeUser,
      },
    });
  };
}

export const authController = new AuthController();
export default authController;
