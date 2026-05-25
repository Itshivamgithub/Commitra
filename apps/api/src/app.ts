import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import logger from './lib/logger';
import authRouter from './modules/auth/auth.router';
import reposRouter from './modules/repos/repos.router';
import analyticsRouter from './modules/analytics/analytics.router';
import aiRouter from './modules/ai/ai.router';
import complexityRouter from './modules/complexity/complexity.router';
import webhooksRouter from './modules/webhooks/webhooks.router';
import notificationsRouter from './modules/notifications/notifications.router';
import workspacesRouter from './modules/workspaces/workspaces.router';
import reportsRouter from './modules/reports/reports.router';

import { initJobs } from './jobs/jobs.module';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { syncQueue, analyticsQueue } from './jobs/queues';
import { initSocketServer } from './lib/socket';
import { generalLimiter } from './middleware/rateLimiter';
import { cacheService } from './lib/cache.service';
import { metricsMiddleware, register } from './lib/metrics';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const app = express();
const httpServer = createServer(app);

// BigInt JSON serialization fix
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Swagger Setup
if (env.NODE_ENV === 'development') {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Commitra API',
        version: '1.0.0',
      },
    },
    apis: ['./src/modules/**/*.router.ts'],
  };
  const spec = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
}


// Initialize Socket.io
initSocketServer(httpServer);

// Apply metrics middleware
app.use(metricsMiddleware);

// Metrics endpoint (no auth)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    let dbStatus = 'error';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'ok';
    } catch (e) {}

    let redisStatus = 'error';
    try {
      await redis.ping();
      redisStatus = 'ok';
    } catch (e) {}

    const syncWaiting = await syncQueue.getWaitingCount();
    const syncActive = await syncQueue.getActiveCount();
    const syncCompleted = await syncQueue.getCompletedCount();
    const syncFailed = await syncQueue.getFailedCount();

    const analyticsWaiting = await analyticsQueue.getWaitingCount();
    const analyticsActive = await analyticsQueue.getActiveCount();
    const analyticsCompleted = await analyticsQueue.getCompletedCount();
    const analyticsFailed = await analyticsQueue.getFailedCount();

    const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'error';

    const healthData = {
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        queues: {
          sync: { waiting: syncWaiting, active: syncActive, completed: syncCompleted, failed: syncFailed },
          analytics: { waiting: analyticsWaiting, active: analyticsActive, completed: analyticsCompleted, failed: analyticsFailed }
        }
      }
    };

    if (status === 'error') {
      return res.status(503).json(healthData);
    }
    return res.status(200).json(healthData);
  } catch (error) {
    return res.status(503).json({ status: 'error' });
  }
});

// Trust proxy for secure cookies in environments like Docker/Heroku
app.set('trust proxy', 1);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(syncQueue),
    new BullMQAdapter(analyticsQueue),
  ],
  serverAdapter,
});

// Protect with middleware in production
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (env.NODE_ENV === 'production') {
    const token = req.headers['x-admin-token'];
    if (token !== env.ADMIN_TOKEN) {
      return res.status(401).send('Unauthorized');
    }
  }
  next();
};

app.use('/admin/queues', adminAuth, serverAdapter.getRouter());

app.get('/admin/cache/stats', adminAuth, async (req, res) => {
  const stats = await cacheService.getStats();
  return res.json({ success: true, data: stats });
});

// Configure CORS with credentials support for secure httpOnly cookies
app.use(
  cors({
    origin: env.NODE_ENV === 'development' 
      ? [env.WEB_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'] 
      : env.WEB_URL,
    credentials: true,
  })
);

app.use(cookieParser());

// Apply general rate limiter to all API routes
app.use('/api', generalLimiter);

// GitHub Webhook receiver (must be before global express.json())
app.use('/api/webhooks', webhooksRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Diagnostic Health Check
app.get('/api/health-check', async (req, res) => {
  const models = ['user', 'repository', 'aIInsight', 'complexityReport', 'healthScore', 'commit', 'pullRequest', 'issue'];
  const status: any = { prisma: 'ok', models: {} };
  
  for (const model of models) {
    status.models[model] = (prisma as any)[model] ? 'ready' : 'MISSING';
  }
  
  const missing = Object.values(status.models).filter(v => v === 'MISSING');
  if (missing.length > 0) {
    status.prisma = 'INCOMPLETE - Run npx prisma generate';
  }
  
  return res.json(status);
});

// Structured Request Logger Middleware using pino
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      {
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
      },
      `HTTP ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/repos', reposRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/complexity', complexityRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/reports', reportsRouter);

// Global Error Handler Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(
    {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
    },
    'An unhandled exception occurred in the application'
  );

  return res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start listening
httpServer.listen(env.PORT, async () => {
  await initJobs();
  logger.info(`Commitra API Server running on ${env.API_URL} (Port: ${env.PORT})`);
});

export default app;
