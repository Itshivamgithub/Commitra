import { useEffect } from 'react';
import { useSocket } from '../providers/SocketProvider';
import { useSWRConfig } from 'swr';

export function useRepoSocket(repoId: string | undefined) {
  const { socket } = useSocket();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!socket || !repoId) return;

    socket.emit('join:repo', repoId);

    const handleAnalyticsUpdated = (data: { repoId: string }) => {
      if (data.repoId === repoId) {
        // Mutate all related keys
        mutate((key) => typeof key === 'string' && key.includes(`/api/analytics/${repoId}`));
      }
    };

    const handleHealthUpdated = (data: { repoId: string }) => {
      if (data.repoId === repoId) {
        mutate(`/api/analytics/${repoId}/health`);
      }
    };

    const handleInsightsReady = (data: { repoId: string }) => {
      if (data.repoId === repoId) {
        mutate(`/api/ai/${repoId}/insights`);
      }
    };

    socket.on('analytics:updated', handleAnalyticsUpdated);
    socket.on('health:updated', handleHealthUpdated);
    socket.on('insights:ready', handleInsightsReady);

    return () => {
      socket.emit('leave:repo', repoId);
      socket.off('analytics:updated', handleAnalyticsUpdated);
      socket.off('health:updated', handleHealthUpdated);
      socket.off('insights:ready', handleInsightsReady);
    };
  }, [socket, repoId, mutate]);
}
