import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { authService } from '../modules/auth/auth.service';
import { ServerToClientEvents, ClientToServerEvents } from '@commitra/types';
import logger from './logger';
import { redis } from './redis';

let io: SocketServer<ClientToServerEvents, ServerToClientEvents>;

export function initSocketServer(httpServer: HttpServer): SocketServer<ClientToServerEvents, ServerToClientEvents> {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.WEB_URL || 'http://localhost:3000',
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Auth middleware — verify JWT on connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
        || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication failed: No token provided'));
      }

      const payload = authService.verifyAccessToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    logger.info({ userId, socketId: socket.id }, 'Socket connected');

    // Connection limiting per user
    const limitConnections = async () => {
      const key = `ws:connections:${userId}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 3600);
      }

      if (count > 5) {
        logger.warn({ userId }, 'Too many connections for user, disconnecting oldest');
        socket.emit('notification', {
          id: 'too-many-connections',
          type: 'warning',
          title: 'Too many connections',
          message: 'You have too many active sessions. Disconnecting this one.',
          timestamp: new Date().toISOString()
        });
        socket.disconnect(true);
      }
    };

    limitConnections().catch(err => logger.error({ err }, 'Failed to limit connections'));

    // Each user joins their own room
    socket.join(`user:${userId}`);

    // Client can join a repo room to get repo-specific updates
    socket.on('join:repo', (repoId: string) => {
      socket.join(`repo:${repoId}`);
      logger.info({ userId, repoId }, 'Joined repo room');
    });

    socket.on('leave:repo', (repoId: string) => {
      socket.leave(`repo:${repoId}`);
      logger.info({ userId, repoId }, 'Left repo room');
    });

    socket.on('disconnect', async () => {
      await redis.decr(`ws:connections:${userId}`);
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
}

export function getIO(): SocketServer<ClientToServerEvents, ServerToClientEvents> {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
