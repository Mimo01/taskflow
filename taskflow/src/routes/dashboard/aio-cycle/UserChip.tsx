import { useQuery } from '@tanstack/react-query';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { JiraAssignableUser } from '@/services/jira/types';
import { fetchJiraUserByUsername } from '@/services/jira/users';

/**
 * Avatar + display name for a Jira username (AIO ownedByID / assignedToID / executedByID).
 * Shares the `user-by-username` cache with AioCycleList's OwnerCell. The credentials are
 * passed in (not read here) so a 50-row list does not read the Stronghold secret 50 times.
 */
export function UserChip({
  userId,
  jiraBaseUrl,
  token,
  size = 18,
  className,
}: {
  userId: string;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
  size?: 16 | 18 | 20 | 24;
  className?: string;
}) {
  const { data: user, isLoading } = useQuery<JiraAssignableUser | null>({
    queryKey: ['jira', jiraBaseUrl, 'user-by-username', userId],
    queryFn: () => fetchJiraUserByUsername(jiraBaseUrl ?? '', token ?? '', userId),
    enabled: !!jiraBaseUrl && !!token && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
        <Skeleton className="size-[18px] flex-none rounded-full" />
        <Skeleton className="h-3.5 w-16" />
      </div>
    );
  }

  const name = user?.displayName ?? userId;
  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)} data-testid="user-chip">
      <CachedAvatar url={user?.avatarUrls?.['48x48'] ?? null} name={name} size={size} />
      <span className="truncate" title={name}>
        {name}
      </span>
    </div>
  );
}
