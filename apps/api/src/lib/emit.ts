import { getIO } from './socket';
import logger from './logger';

export function emitJobProgress(
  userId: string,
  repoId: string,
  jobId: string,
  type: 'sync' | 'health' | 'insights' | 'complexity',
  progress: number,
  message: string
) {
  const io = getIO();
  const data = { jobId, repoId, type, progress, status: 'active', message };
  io.to(`user:${userId}`).emit('job:progress', data);
  io.to(`repo:${repoId}`).emit('job:progress', data);
}

export function emitJobCompleted(
  userId: string,
  repoId: string,
  jobId: string,
  type: 'sync' | 'health' | 'insights' | 'complexity',
  result?: Record<string, unknown>
) {
  const io = getIO();
  const data = { jobId, repoId, type, result };
  io.to(`user:${userId}`).emit('job:completed', data);
  io.to(`repo:${repoId}`).emit('job:completed', data);
}

export function emitJobFailed(
  userId: string,
  repoId: string,
  jobId: string,
  type: 'sync' | 'health' | 'insights' | 'complexity',
  reason: string
) {
  const io = getIO();
  const data = { jobId, repoId, type, reason };
  io.to(`user:${userId}`).emit('job:failed', data);
  io.to(`repo:${repoId}`).emit('job:failed', data);
}

export function emitAnalyticsUpdated(userId: string, repoId: string) {
  const io = getIO();
  const data = { repoId, updatedAt: new Date().toISOString() };
  io.to(`user:${userId}`).emit('analytics:updated', data);
  io.to(`repo:${repoId}`).emit('analytics:updated', data);
}

export function emitHealthUpdated(
  userId: string,
  repoId: string,
  overallScore: number,
  grade: string,
  scoreDelta: number | null
) {
  const io = getIO();
  const data = { repoId, overallScore, grade, scoreDelta };
  io.to(`user:${userId}`).emit('health:updated', data);
  io.to(`repo:${repoId}`).emit('health:updated', data);
}

export function emitInsightsReady(userId: string, repoId: string, types: string[]) {
  const io = getIO();
  const data = { repoId, types };
  io.to(`user:${userId}`).emit('insights:ready', data);
  io.to(`repo:${repoId}`).emit('insights:ready', data);
}

export function emitWebhookReceived(userId: string, repoId: string, event: string, message: string) {
  const io = getIO();
  const data = { repoId, event, message };
  io.to(`user:${userId}`).emit('webhook:received', data);
  io.to(`repo:${repoId}`).emit('webhook:received', data);
}

export function emitNotification(
  userId: string,
  type: 'success' | 'warning' | 'error' | 'info',
  title: string,
  message: string,
  repoId?: string
) {
  const io = getIO();
  const data = {
    id: Math.random().toString(36).substring(7),
    type,
    title,
    message,
    repoId,
    timestamp: new Date().toISOString()
  };
  io.to(`user:${userId}`).emit('notification', data);
}
