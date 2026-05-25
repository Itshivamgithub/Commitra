export type ServerToClientEvents = {
  // Job progress updates
  'job:progress': (data: {
    jobId: string;
    repoId: string;
    type: 'sync' | 'health' | 'insights' | 'complexity';
    progress: number;        // 0–100
    status: string;
    message: string;         // human readable e.g. "Syncing commits..."
  }) => void;

  // Job completion
  'job:completed': (data: {
    jobId: string;
    repoId: string;
    type: 'sync' | 'health' | 'insights' | 'complexity';
    result?: Record<string, unknown>;
  }) => void;

  // Job failure
  'job:failed': (data: {
    jobId: string;
    repoId: string;
    type: 'sync' | 'health' | 'insights' | 'complexity';
    reason: string;
  }) => void;

  // Analytics updated (triggers SWR revalidation)
  'analytics:updated': (data: {
    repoId: string;
    updatedAt: string;
  }) => void;

  // Health score updated
  'health:updated': (data: {
    repoId: string;
    overallScore: number;
    grade: string;
    scoreDelta: number | null;
  }) => void;

  // AI insights ready
  'insights:ready': (data: {
    repoId: string;
    types: string[];
  }) => void;

  // Webhook event received
  'webhook:received': (data: {
    repoId: string;
    event: string;           // push | pull_request | issues
    message: string;         // e.g. "New push to main — syncing..."
  }) => void;

  // Notification
  'notification': (data: {
    id: string;
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
    repoId?: string;
    timestamp: string;
  }) => void;
};

export type ClientToServerEvents = {
  'join:repo': (repoId: string) => void;
  'leave:repo': (repoId: string) => void;
};
