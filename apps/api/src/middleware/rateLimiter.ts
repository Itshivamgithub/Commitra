import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../lib/redis';
import { Request } from 'express';
import { env } from '../config/env';

const isDev = env.NODE_ENV === 'development';

const createStore = (prefix: string) => new RedisStore({
  // @ts-expect-error - ioredis type mismatch with rate-limit-redis
  sendCommand: (...args: string[]) => redis.call(...args),
  prefix: `rl:${prefix}:`,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 200, // much higher limit for dev
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('general'),
  message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes' }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 20, // higher limit for dev
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth'),
  message: { success: false, error: 'Too many login attempts, please try again after 15 minutes' }
});

export const syncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 1000 : 10,
  keyGenerator: (req: Request) => (req.user as any)?.id || req.ip || 'anonymous',
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('sync'),
  message: { success: false, error: 'Sync limit reached. Max 10 syncs per hour.' }
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 1000 : 5,
  keyGenerator: (req: Request) => (req.user as any)?.id || req.ip || 'anonymous',
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('ai'),
  message: { success: false, error: 'AI generation limit reached. Max 5 per hour.' }
});

export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('webhook'),
  message: { success: false, error: 'Too many webhooks received' }
});
