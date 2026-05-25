import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';

/**
 * Middleware that requires a valid JWT access token in the Authorization header.
 * Attaches the authenticated user object to the request object.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;
    
    // 1. Check Authorization Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // 2. Fallback to accessToken cookie if header is missing
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No token provided',
      });
    }
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or expired token',
      });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid token payload',
      });
    }

    // Load user from database to ensure they exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not found',
      });
    }

    logger.info({ userId: user.id, username: user.username, path: req.originalUrl || req.url }, 'Authenticated request');

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
