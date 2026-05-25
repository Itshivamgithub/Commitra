import useSWR from 'swr';
import api from '../lib/api';

const fetcher = (url: string) => api.get(url).then((res) => res.data.data);

export function useRepoOverview(repoId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    repoId ? `/api/analytics/${repoId}/overview` : null,
    fetcher
  );

  return {
    overview: data,
    isLoading,
    isError: error,
    mutate,
  };
}
