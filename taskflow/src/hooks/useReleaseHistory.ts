import { useQuery } from '@tanstack/react-query';
import { withBundledNotes } from '@/lib/release-notes/bundled';
import { fetchAllReleases, isRateLimited } from '@/services/releases';

/**
 * Shared release-history query for the Update modal, What's new modal and
 * Settings → Updates. One key keeps GitHub's unauthenticated 60/h limit safe.
 */
export function useReleaseHistory({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['github-releases', 'all'],
    // Prefer the concise CHANGELOG.md rewrite shipped in this build over wordy GitHub bodies.
    queryFn: async () => withBundledNotes(await fetchAllReleases()),
    enabled,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => failureCount < 1 && !isRateLimited(error),
  });
}
