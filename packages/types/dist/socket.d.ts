export type ServerToClientEvents = {
    'job:progress': (data: {
        jobId: string;
        repoId: string;
        type: 'sync' | 'health' | 'insights' | 'complexity';
        progress: number;
        status: string;
        message: string;
    }) => void;
    'job:completed': (data: {
        jobId: string;
        repoId: string;
        type: 'sync' | 'health' | 'insights' | 'complexity';
        result?: Record<string, unknown>;
    }) => void;
    'job:failed': (data: {
        jobId: string;
        repoId: string;
        type: 'sync' | 'health' | 'insights' | 'complexity';
        reason: string;
    }) => void;
    'analytics:updated': (data: {
        repoId: string;
        updatedAt: string;
    }) => void;
    'health:updated': (data: {
        repoId: string;
        overallScore: number;
        grade: string;
        scoreDelta: number | null;
    }) => void;
    'insights:ready': (data: {
        repoId: string;
        types: string[];
    }) => void;
    'webhook:received': (data: {
        repoId: string;
        event: string;
        message: string;
    }) => void;
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
//# sourceMappingURL=socket.d.ts.map