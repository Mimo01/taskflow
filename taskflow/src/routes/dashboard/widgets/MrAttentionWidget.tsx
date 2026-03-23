/**
 * MrAttentionWidget -- compact MR attention list for the widget grid.
 *
 * Shows up to 5 MRs needing the user's review. Loads GitLab token internally
 * and shares the TanStack Query cache with MrAttentionTab.
 */

import { useQuery } from '@tanstack/react-query';
import { GitMerge } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAssignedMRs, fetchReviewerMRs } from '@/services/gitlab';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

function daysSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export default function MrAttentionWidget(_props: { widgetId: string }) {
  const { gitlabBaseUrl, gitlabUserId, _hasHydrated } = useAuthStore();
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  useEffect(() => {
    if (gitlabBaseUrl) {
      setTokenLoading(true);
      readSecret('gitlab-pat')
        .then(setGitlabToken)
        .catch(() => setGitlabToken(null))
        .finally(() => setTokenLoading(false));
    } else if (_hasHydrated) {
      setTokenLoading(false);
    }
  }, [gitlabBaseUrl, _hasHydrated]);

  const userId = gitlabUserId ?? undefined;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gitlab-mrs-widget', gitlabBaseUrl, userId],
    queryFn: async () => {
      const token = gitlabToken ?? '';
      const [assigned, reviewer] = await Promise.all([
        fetchAssignedMRs(gitlabBaseUrl!, token),
        userId ? fetchReviewerMRs(gitlabBaseUrl!, token, userId) : Promise.resolve([]),
      ]);
      const seen = new Set<number>();
      return [...assigned, ...reviewer].filter((mr) => !seen.has(mr.iid) && seen.add(mr.iid));
    },
    staleTime: 30_000,
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId,
  });

  if (tokenLoading || isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load MRs'}
        </span>
      </div>
    );
  }

  const mrs = data ?? [];
  if (mrs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <GitMerge className="size-5" />
          <span className="text-sm">No MRs need attention</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 overflow-auto">
      {mrs.slice(0, 5).map((mr) => (
        <div
          key={mr.iid}
          className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 text-sm"
        >
          <GitMerge className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{mr.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {daysSince(mr.updated_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
