import Redis from 'ioredis';
import { env } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

export const redis = global.redis || new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

if (process.env.NODE_ENV !== 'production') {
  global.redis = redis;
}
