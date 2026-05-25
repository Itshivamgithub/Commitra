import { Queue } from 'bullmq';
import { redis } from '../../lib/redis';

const connection = { connection: redis };

export const syncQueue = new Queue('repo-sync', connection);
export const analyticsQueue = new Queue('repo-analytics', connection);
