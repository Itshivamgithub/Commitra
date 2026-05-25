import api from './api';

export async function pollJobStatus(
  repoId: string,
  jobId: string,
  onProgress: (progress: number) => void,
  onComplete: () => void,
  onError: (reason: string) => void,
  intervalMs = 3000,
  timeoutMs = 300000 // 5 min max
): Promise<void> {
  const startTime = Date.now();

  const interval = setInterval(async () => {
    if (Date.now() - startTime > timeoutMs) {
      clearInterval(interval);
      onError('Polling timeout exceeded');
      return;
    }

    try {
      const response = await api.get(`/api/analytics/${repoId}/sync/status?jobId=${jobId}`);
      const job = response.data.data;

      if (job.progress !== undefined) {
        onProgress(job.progress);
      }

      if (job.status === 'completed') {
        clearInterval(interval);
        onComplete();
      } else if (job.status === 'failed') {
        clearInterval(interval);
        onError(job.failedReason || 'Job failed');
      }
    } catch (error: any) {
      clearInterval(interval);
      onError(error.response?.data?.error || 'Failed to check job status');
    }
  }, intervalMs);
}
