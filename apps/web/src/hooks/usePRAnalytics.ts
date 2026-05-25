import useSWR from 'swr';
import api from '../lib/api';

const fetcher = (url: string) => api.get(url).then((res) => res.data.data);

export function usePRAnalytics(repoId: string | undefined, range: string) {
  const { data, error, isLoading } = useSWR(
    repoId ? `/api/analytics/${repoId}/pullrequests?range=${range}` : null,
    fetcher
  );

  return {
    data,
    isLoading,
    isError: error,
  };
}
