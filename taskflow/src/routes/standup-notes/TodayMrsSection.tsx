/**
 * TodayMrsSection — MRs Awaiting You rows in the Today column.
 *
 * Renders open GitLab MRs where the current user is a reviewer.
 * Rows are non-interactive display-only divs (no navigation in Phase 70).
 *
 * Review state derivation: GitLabMR from fetchReviewerMRs does NOT include a
 * `review_state` field at the list endpoint level (RESEARCH correction #2 /
 * Option A). All returned opened MRs are shown as "awaiting review".
 * A "changes requested" amber label path is left as a code comment for
 * future enrichment via fetchMRApprovals.
 *
 * Section is hidden entirely when GitLab is not connected — TodayColumn gates
 * the render on !!gitlabBaseUrl (D-10). Section degrades per D-03: skeleton
 * while loading, ErrorState on error, returns null when 0 items.
 */

import { GitBranch } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { GitLabMR } from '@/services/gitlab';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TodayMrsSectionProps {
  items: GitLabMR[];
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

export default function TodayMrsSection({
  items,
  isLoading,
  isError,
  error,
  onRetry,
}: TodayMrsSectionProps) {
  const showSkeleton = useDelayedLoading(isLoading);

  // D-03: hidden when empty + settled
  if (!isLoading && !showSkeleton && !isError && items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
        MRS AWAITING YOU
      </h3>

      {showSkeleton ? (
        <LoadingSkeletons />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} viewName="MRs awaiting you" />
      ) : (
        <div className="divide-y divide-border">
          {items.map((mr) => {
            // Option A (RESEARCH correction #2): GitLabMR has no review_state field at
            // list endpoint level. All returned opened MRs are shown as "awaiting review".
            // Future: enrich with fetchMRApprovals per MR to derive "changes requested"
            // (amber) or "approved" (filter out) — too expensive for standup column today.
            const reviewStateLabel = 'awaiting review';
            const reviewStateLabelClass = 'text-xs text-muted-foreground shrink-0';
            // amber path (future enrichment):
            // if (mr.review_state === 'changes_requested') {
            //   reviewStateLabel = 'changes requested';
            //   reviewStateLabelClass = 'text-xs text-amber-600 dark:text-amber-400 font-semibold shrink-0';
            // }

            return (
              <div key={mr.iid} className="flex items-center gap-2 py-2 px-2">
                <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  !{mr.iid}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">{mr.title}</span>
                <span className={reviewStateLabelClass}>{reviewStateLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
