import useSWR from 'swr';
import api from '../lib/api';

const fetcher = (url: string) => api.get(url).then((res) => res.data.data);

export function useContributors(repoId: string | undefined) {
  const { data, error, isLoading } = useSWR(
    repoId ? `/api/analytics/${repoId}/contributors` : null,
    fetcher
  );

  return {
    data,
    isLoading,
    isError: error,
  };
}
