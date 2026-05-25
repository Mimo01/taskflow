/**
 * TodayUpNextSection — Up Next rows in the Today column.
 *
 * Renders the user's leaf sprint issues with statusCategory.key === 'new'.
 * Identical to TodayInProgressSection except:
 *   - No logged-time chip (Up Next rows haven't been worked yet today)
 *   - Log Work trigger is still present (D-06: all open sprint work is loggable)
 *
 * Section degrades per D-03: skeleton while loading, ErrorState on error,
 * returns null (hidden) when 0 items + not loading + not erroring.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { JiraIssue } from '@/services/jira';
import { LogWorkPopover } from '@/routes/dashboard/issue-detail/LogWorkPopover';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TodayUpNextSectionProps {
  items: JiraIssue[];
  storyPointsFieldKey: string;
  jiraBaseUrl: string;
  todayStr: string;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  onIssueClick: (key: string) => void;
  onLogWorkSuccess: () => void;
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

export default function TodayUpNextSection({
  items,
  storyPointsFieldKey,
  jiraBaseUrl,
  todayStr,
  isLoading,
  isError,
  error,
  onRetry,
  onIssueClick,
  onLogWorkSuccess,
}: TodayUpNextSectionProps) {
  const showSkeleton = useDelayedLoading(isLoading);

  // D-03: hidden when empty + settled
  if (!isLoading && !showSkeleton && !isError && items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">UP NEXT</h3>

      {showSkeleton ? (
        <LoadingSkeletons />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} viewName="Up Next items" />
      ) : (
        <div className="divide-y divide-border">
          {items.map((issue) => {
            const issueType = issue.fields.issuetype.name;
            const key = issue.key;
            const summary = issue.fields.summary;
            const sp = issue.fields[storyPointsFieldKey] as number | null;

            return (
              <button
                key={key}
                type="button"
                className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onIssueClick(key)}
              >
                <IssueTypeIcon typeName={issueType} className="size-4 shrink-0" />
                <span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
                <span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
                {sp != null && (
                  <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {sp} pts
                  </span>
                )}
                {/* stopPropagation: Log Work must NOT trigger row navigation (D-07, Pitfall 4) */}
                <span onClick={(e) => e.stopPropagation()}>
                  <LogWorkPopover
                    issueKey={key}
                    jiraBaseUrl={jiraBaseUrl}
                    initialDate={todayStr}
                    onSuccess={onLogWorkSuccess}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
