import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { syncQueue, analyticsQueue } from '../jobs/queues';

export const register = new Registry();
register.setDefaultLabels({ app: 'commitra-api' });

// HTTP request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register]
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Queue metrics
export const jobsProcessed = new Counter({
  name: 'bullmq_jobs_processed_total',
  help: 'Total jobs processed',
  labelNames: ['queue', 'status'],   // status: completed | failed
  registers: [register]
});

export const queueDepth = new Gauge({
  name: 'bullmq_queue_depth',
  help: 'Current number of waiting jobs',
  labelNames: ['queue'],
  registers: [register]
});

// Business metrics
export const repoSyncDuration = new Histogram({
  name: 'repo_sync_duration_seconds',
  help: 'Time to complete a full repo sync',
  buckets: [5, 10, 30, 60, 120, 300],
  registers: [register]
});

export const aiGenerationDuration = new Histogram({
  name: 'ai_generation_duration_seconds',
  help: 'Time to generate AI insights',
  buckets: [1, 2, 5, 10, 20, 30],
  registers: [register]
});

export const cacheHitRate = new Gauge({
  name: 'redis_cache_hit_rate',
  help: 'Cache hit rate percentage',
  registers: [register]
});

export const activeWebsocketConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Currently active WebSocket connections',
  registers: [register]
});

// HTTP middleware to record metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  next();
}

// Update queue depth gauge on a schedule
setInterval(async () => {
  try {
    const syncWaiting = await syncQueue.getWaitingCount();
    const analyticsWaiting = await analyticsQueue.getWaitingCount();
    queueDepth.labels('sync').set(syncWaiting);
    queueDepth.labels('analytics').set(analyticsWaiting);
  } catch (error) {
    // Silent fail if redis is down during interval
  }
}, 15000);
