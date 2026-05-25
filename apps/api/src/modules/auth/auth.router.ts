import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';
import { authLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Apply auth rate limiter
router.use(authLimiter);

// OAuth initiation
router.get('/github', authController.githubLogin);

// OAuth Callback
router.get('/github/callback', tryCatch(authController.githubCallback));

// Token refresh
router.post('/refresh', tryCatch(authController.refresh));

// Logout
router.post('/logout', tryCatch(authController.logout));

// Rehydrate user profile
router.get('/me', tryCatch(requireAuth), tryCatch(authController.getMe));

export default router;
