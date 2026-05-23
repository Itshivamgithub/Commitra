import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import logger from './lib/logger';
import authRouter from './modules/auth/auth.router';
import reposRouter from './modules/repos/repos.router';

const app = express();

// Configure CORS with credentials support for secure httpOnly cookies
app.use(
  cors({
    origin: env.WEB_URL,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.listen(env.PORT, () => {
  logger.info(`Commitra API Server running on ${env.API_URL} (Port: ${env.PORT})`);
});

export default app;
