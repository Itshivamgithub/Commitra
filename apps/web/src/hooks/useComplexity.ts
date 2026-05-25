import useSWR from 'swr';
import api from '../lib/api';

const fetcher = (url: string) => api.get(url).then((res) => res.data.data);

export function useComplexity(repoId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    repoId ? `/api/complexity/${repoId}` : null,
    fetcher
  );

  return {
    data,
    isLoading,
    isError: error,
    mutate,
  };
}
