import { useQuery } from '@tanstack/react-query';
import { fetchAllReleases } from '@/services/releases';

/**
 * Shared release-history query for the Update modal, What's new modal and
 * Settings → Updates. One key keeps GitHub's unauthenticated 60/h limit safe.
 */
export function useReleaseHistory({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['github-releases', 'all'],
    queryFn: fetchAllReleases,
    enabled,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
