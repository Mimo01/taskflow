/**
 * TodayPinnedSection — Pinned rows in the Today column.
 *
 * Renders two row variants read-only (D-08: no pin/unpin controls):
 *   - Jira issue rows: IssueTypeIcon + key + summary → onIssueClick(key)
 *   - AIO cycle rows: ListChecks icon + projectKey + name → onCycleClick(key)
 *
 * Row type is determined by whether the key is present in pinnedCycleMeta:
 *   - key in pinnedCycleMeta → AIO cycle
 *   - key NOT in pinnedCycleMeta → Jira issue (resolved via pinnedMeta / fetchIssueMeta)
 *
 * Section degrades per D-03: skeleton while loading, ErrorState on error,
 * returns null (hidden) when no pinned items + not loading + not erroring.
 */

import { FlaskConical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { StandupIssueMeta } from '@/services/jira';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TodayPinnedSectionProps {
  pinnedJiraKeys: string[];
  pinnedCycleKeys: string[];
  pinnedCycleMeta: Record<string, { name: string; projectKey: string }>;
  pinnedMeta: Record<string, StandupIssueMeta>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  onIssueClick: (key: string) => void;
  onCycleClick: (key: string) => void;
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

export default function TodayPinnedSection({
  pinnedJiraKeys,
  pinnedCycleKeys,
  pinnedCycleMeta,
  pinnedMeta,
  isLoading,
  isError,
  error,
  onRetry,
  onIssueClick,
  onCycleClick,
}: TodayPinnedSectionProps) {
  const showSkeleton = useDelayedLoading(isLoading);

  const totalItems = pinnedJiraKeys.length + pinnedCycleKeys.length;

  // D-03: hidden when empty + settled
  if (!isLoading && !showSkeleton && !isError && totalItems === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">PINNED</h3>

      {showSkeleton ? (
        <LoadingSkeletons />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} viewName="Pinned items" />
      ) : (
        <div className="divide-y divide-border">
          {/* Jira issue pinned rows */}
          {pinnedJiraKeys.map((key) => {
            const meta = pinnedMeta[key];
            return (
              <button
                key={key}
                type="button"
                className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                onClick={() => onIssueClick(key)}
              >
                <IssueTypeIcon typeName={meta?.type ?? 'Task'} className="size-4 shrink-0" />
                <span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
                <span className="flex-1 min-w-0 truncate text-sm">{meta?.summary ?? key}</span>
              </button>
            );
          })}

          {/* AIO cycle pinned rows (D-09: navigate to /aio-cycle/{projectKey}/{key}) */}
          {pinnedCycleKeys.map((key) => {
            const cycleMeta = pinnedCycleMeta[key];
            if (!cycleMeta) return null;
            return (
              <button
                key={key}
                type="button"
                className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                onClick={() => onCycleClick(key)}
              >
                <FlaskConical className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {cycleMeta.projectKey}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">{cycleMeta.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
