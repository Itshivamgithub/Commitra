import useSWR from 'swr';
import api from '../lib/api';

const fetcher = (url: string) => api.get(url).then((res) => res.data.data);

export function useHealthScore(repoId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    repoId ? `/api/analytics/${repoId}/health` : null,
    fetcher
  );

  return {
    health: data,
    isLoading,
    isError: error,
    mutate,
  };
}
