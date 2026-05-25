import { redis } from './redis';
import { emitNotification } from './emit';
import logger from './logger';

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  repoId?: string;
  actionUrl?: string;
  timestamp: string;
  read: boolean;
}

class NotificationService {
  private readonly KEY_PREFIX = 'notifications:';
  private readonly TTL = 604800; // 7 days

  async addNotification(
    userId: string,
    notif: {
      type: 'success' | 'warning' | 'error' | 'info';
      title: string;
      message: string;
      repoId?: string;
      actionUrl?: string;
    }
  ): Promise<string> {
    const id = Math.random().toString(36).substring(2, 15);
    const timestamp = new Date().toISOString();
    const notification: Notification = {
      ...notif,
      id,
      timestamp,
      read: false
    };

    const key = `${this.KEY_PREFIX}${userId}`;
    const score = Date.now();

    try {
      // Add to Redis sorted set
      await redis.zadd(key, score, JSON.stringify(notification));
      
      // Cleanup old entries (older than 7 days)
      const sevenDaysAgo = Date.now() - (this.TTL * 1000);
      await redis.zremrangebyscore(key, '-inf', sevenDaysAgo);
      
      // Set TTL on the key itself
      await redis.expire(key, this.TTL);

      // Emit via Socket.io
      emitNotification(userId, notification.type, notification.title, notification.message, notification.repoId);

      return id;
    } catch (error: any) {
      logger.error({ userId, error: error.message }, 'Failed to add notification');
      return id;
    }
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const key = `${this.KEY_PREFIX}${userId}`;
    try {
      const entries = await redis.zrevrange(key, 0, 29);
      return entries.map(entry => JSON.parse(entry));
    } catch (error: any) {
      logger.error({ userId, error: error.message }, 'Failed to get notifications');
      return [];
    }
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}${userId}`;
    try {
      const entries = await redis.zrange(key, 0, -1);
      for (const entry of entries) {
        const notif = JSON.parse(entry) as Notification;
        if (notif.id === notificationId) {
          if (notif.read) return;
          
          const updatedNotif = { ...notif, read: true };
          const score = new Date(notif.timestamp).getTime();
          
          await redis.zrem(key, entry);
          await redis.zadd(key, score, JSON.stringify(updatedNotif));
          break;
        }
      }
    } catch (error: any) {
      logger.error({ userId, notificationId, error: error.message }, 'Failed to mark notification as read');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}${userId}`;
    try {
      const entries = await redis.zrange(key, 0, -1);
      const pipeline = redis.pipeline();
      
      for (const entry of entries) {
        const notif = JSON.parse(entry) as Notification;
        if (!notif.read) {
          const updatedNotif = { ...notif, read: true };
          const score = new Date(notif.timestamp).getTime();
          pipeline.zrem(key, entry);
          pipeline.zadd(key, score, JSON.stringify(updatedNotif));
        }
      }
      
      await pipeline.exec();
    } catch (error: any) {
      logger.error({ userId, error: error.message }, 'Failed to mark all notifications as read');
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const key = `${this.KEY_PREFIX}${userId}`;
    try {
      const entries = await redis.zrange(key, 0, -1);
      return entries.filter(entry => !JSON.parse(entry).read).length;
    } catch (error: any) {
      return 0;
    }
  }

  async clearAll(userId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}${userId}`;
    await redis.del(key);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
