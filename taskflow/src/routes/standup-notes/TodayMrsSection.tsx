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
  onMRClick: (projectIdAndIid: string) => void;
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
  onMRClick,
}: TodayMrsSectionProps) {
  const showSkeleton = useDelayedLoading(isLoading);

  // D-03: hidden when empty + settled
  if (!isLoading && !showSkeleton && !isError && items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 border-t border-border pt-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wide">MRS AWAITING YOU</h3>
        {items.length > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{items.length}</span>
        )}
      </div>

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
              <div
                key={mr.iid}
                role="button"
                tabIndex={0}
                className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                onClick={() => onMRClick(`${mr.project_id}/${mr.iid}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onMRClick(`${mr.project_id}/${mr.iid}`);
                }}
              >
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
