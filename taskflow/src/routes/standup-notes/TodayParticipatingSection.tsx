/**
 * TodayParticipatingSection — MRs the user has commented on (participating in).
 *
 * Role-independent: based on the user's own `commented` events, not MR
 * assignment. An MR appears here even when the user is not an assignee,
 * reviewer, or author — only participation (commenting) matters.
 *
 * Section is hidden entirely when GitLab is not connected — TodayColumn gates
 * the render on !!gitlabBaseUrl. Section degrades per D-03: skeleton while
 * loading, ErrorState on error, returns null when 0 items.
 */

import { MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { ParticipatedMR } from '@/services/gitlab';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TodayParticipatingSectionProps {
  items: ParticipatedMR[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeletons() {
  return (
    <div className="flex flex-col gap-2 py-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayParticipatingSection({
  items,
  isLoading,
  isError,
  error,
  onRetry,
}: TodayParticipatingSectionProps) {
  const showSkeleton = useDelayedLoading(isLoading);

  // D-03: hidden when empty + settled
  if (!isLoading && !showSkeleton && !isError && items.length === 0) {
    return null;
  }

  const header =
    items.length > 0 ? `PARTICIPATING (${items.length})` : 'PARTICIPATING';

  return (
    <div className="mb-6">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
        {header}
      </h3>

      {showSkeleton ? (
        <LoadingSkeletons />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} viewName="participating MRs" />
      ) : (
        <div className="divide-y divide-border">
          {items.map((mr) => (
            <div
              key={`${mr.projectId}:${mr.mrIid}`}
              className="flex items-center gap-2 py-2 px-2"
            >
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                !{mr.mrIid}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm">{mr.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {mr.commentCount} comment{mr.commentCount !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
