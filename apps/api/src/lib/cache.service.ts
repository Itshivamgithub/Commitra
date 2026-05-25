import { redis } from './redis';
import logger from './logger';
import { prisma } from './prisma';

class CacheService {
  /**
   * Generic get-or-set with mutex (prevents stampede)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    try {
      // 1. Try GET key from Redis
      const cached = await redis.get(key);
      if (cached) {
        await redis.incr('cache:stats:hits');
        return JSON.parse(cached);
      }

      await redis.incr('cache:stats:misses');

      // 2. Acquire a Redis lock (mutex)
      const lockKey = `${key}:lock`;
      const lockAcquired = await redis.set(lockKey, '1', 'EX', 10, 'NX' as const);

      if (lockAcquired) {
        try {
          // Double-check key (another process may have populated it)
          const doubleCheck = await redis.get(key);
          if (doubleCheck) return JSON.parse(doubleCheck);

          // 3. call fetchFn()
          const result = await fetchFn();

          // 4. SET key with result + TTL
          await redis.setex(key, ttlSeconds, JSON.stringify(result));
          return result;
        } finally {
          // Release lock
          await redis.del(lockKey);
        }
      } else {
        // 5. Wait 100ms and retry GET (up to 5 retries)
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          const retryCached = await redis.get(key);
          if (retryCached) return JSON.parse(retryCached);
        }
        
        // Fallback: fetch directly
        logger.warn({ key }, 'Cache lock contention, falling back to direct fetch');
        return fetchFn();
      }
    } catch (error: any) {
      logger.error({ key, error: error.message }, 'Cache getOrSet error');
      return fetchFn();
    }
  }

  /**
   * Invalidate a set of related keys by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    try {
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length) {
          await redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');
      return deleted;
    } catch (error: any) {
      logger.error({ pattern, error: error.message }, 'Cache invalidatePattern error');
      return 0;
    }
  }

  /**
   * Tag-based invalidation
   */
  async tagKey(tag: string, key: string): Promise<void> {
    const tagKey = `cache:tag:${tag}`;
    await redis.sadd(tagKey, key);
    await redis.expire(tagKey, 86400); // 24h max
  }

  async invalidateTag(tag: string): Promise<void> {
    const tagKey = `cache:tag:${tag}`;
    try {
      const keys = await redis.smembers(tagKey);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.del(tagKey);
    } catch (error: any) {
      logger.error({ tag, error: error.message }, 'Cache invalidateTag error');
    }
  }

  /**
   * Stale-while-revalidate pattern
   */
  async getStaleOrFresh<T>(
    key: string,
    fetchFn: () => Promise<T>,
    freshTTL: number,
    staleTTL: number
  ): Promise<{ data: T; stale: boolean }> {
    const freshKey = `${key}:fresh`;
    const dataKey = `${key}:data`;

    try {
      const freshExists = await redis.exists(freshKey);
      const data = await redis.get(dataKey);

      if (freshExists && data) {
        await redis.incr('cache:stats:hits');
        return { data: JSON.parse(data), stale: false };
      }

      if (data) {
        // Stale hit: return data and trigger background refresh
        await redis.incr('cache:stats:hits');
        this.refreshInBackground(key, fetchFn, freshTTL, staleTTL).catch(err => 
          logger.error({ key, error: err.message }, 'Background cache refresh failed')
        );
        return { data: JSON.parse(data), stale: true };
      }

      // Complete miss
      await redis.incr('cache:stats:misses');
      const freshData = await fetchFn();
      await this.setStaleAndFresh(key, freshData, freshTTL, staleTTL);
      return { data: freshData, stale: false };
    } catch (error: any) {
      logger.error({ key, error: error.message }, 'Cache getStaleOrFresh error');
      const fallbackData = await fetchFn();
      return { data: fallbackData, stale: false };
    }
  }

  private async refreshInBackground<T>(key: string, fetchFn: () => Promise<T>, freshTTL: number, staleTTL: number) {
    const freshData = await fetchFn();
    await this.setStaleAndFresh(key, freshData, freshTTL, staleTTL);
  }

  private async setStaleAndFresh<T>(key: string, data: T, freshTTL: number, staleTTL: number) {
    const freshKey = `${key}:fresh`;
    const dataKey = `${key}:data`;
    const stringified = JSON.stringify(data);
    await Promise.all([
      redis.setex(freshKey, freshTTL, '1'),
      redis.setex(dataKey, staleTTL, stringified)
    ]);
  }

  /**
   * Cache warming
   */
  async warmCache(repoId: string, userId: string): Promise<void> {
    const { analyticsService } = await import('../modules/analytics/analytics.service');
    
    // Concurrently fetch and cache common keys
    // We don't use getOrSet here because we WANT to overwrite/re-populate
    try {
      await Promise.all([
        analyticsService.getOverview(repoId),
        analyticsService.getCommits(repoId, '30d'),
        analyticsService.getPullRequests(repoId, '30d'),
        analyticsService.getIssues(repoId, '30d'),
        analyticsService.getHealth(repoId).catch(() => null) // might not exist yet
      ]);
      logger.info({ repoId }, 'Cache warmed for repo');
    } catch (error: any) {
      logger.error({ repoId, error: error.message }, 'Failed to warm cache');
    }
  }

  async getStats() {
    const [keyCount, memoryInfo, hits, misses] = await Promise.all([
      redis.dbsize(),
      redis.info('memory'),
      redis.get('cache:stats:hits'),
      redis.get('cache:stats:misses')
    ]);

    const usedMemoryHuman = memoryInfo.match(/used_memory_human:(.*)/)?.[1] || 'unknown';
    const hitsNum = parseInt(hits || '0');
    const missesNum = parseInt(misses || '0');
    const total = hitsNum + missesNum;
    const hitRate = total > 0 ? ((hitsNum / total) * 100).toFixed(2) + '%' : '0%';

    // Sample top keys (using scan)
    const [_, keys] = await redis.scan(0, 'COUNT', 20);
    const topKeys = await Promise.all(keys.map(async key => ({
      key,
      ttl: await redis.ttl(key)
    })));

    return {
      keyCount,
      memoryUsed: usedMemoryHuman,
      hitRate,
      topKeys
    };
  }
}

export const cacheService = new CacheService();
export default cacheService;
