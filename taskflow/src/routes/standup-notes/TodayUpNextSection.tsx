/**
 * TodayUpNextSection — Up Next rows in the Today column.
 *
 * Renders the user's sprint items with statusCategory.key === 'new'.
 * Identical to TodayInProgressSection except:
 *   - No logged-time chip (Up Next rows haven't been worked yet today)
 *   - Log Work trigger is still present (D-06: all open sprint work is loggable)
 *
 * Each row is a grouped SprintRow: the parent story is the top-level button,
 * with my assigned subtasks nested/indented beneath it (Decision 1).
 *
 * Each row (parent + subtask) shows a progress bar (shared ui/Progress) when an
 * original estimate exists: value = timeSpentSeconds / originalEstimateSeconds
 * (clamped 100%), with a "spent / estimate" caption (Decision 2).
 *
 * Section degrades per D-03: skeleton while loading, ErrorState on error,
 * returns null (hidden) when 0 rows + not loading + not erroring.
 */

import { Coffee, GitBranch } from 'lucide-react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { ErrorState } from '@/components/ui/error-state';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import type { SprintRow } from './filterSprintItems';
import type { NestedMr } from './mrMatching';
import StandupSectionHeader from './StandupSectionHeader';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TodayUpNextSectionProps {
  rows: SprintRow[];
  mrsByStory: Map<string, NestedMr[]>;
  storyPointsFieldKey: string;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  onIssueClick: (key: string) => void;
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

// ─── Progress bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  issue: JiraIssue;
}

function ProgressBar({ issue }: ProgressBarProps) {
  const tt = issue.fields.timetracking;
  const originalSec = tt?.originalEstimateSeconds;
  if (!originalSec || originalSec <= 0) return null;

  const spentSec = tt?.timeSpentSeconds ?? 0;
  const fillPct = Math.min(100, Math.round((spentSec / originalSec) * 100));
  const indicatorColor =
    spentSec >= originalSec ? 'bg-red-500' : fillPct >= 75 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="shrink-0 flex items-center gap-2">
      <Progress value={fillPct} className="w-20" indicatorClassName={indicatorColor} />
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDuration(spentSec)} / {formatDuration(originalSec)}
      </span>
    </div>
  );
}

// ─── Issue row (reused for parent and subtask) ────────────────────────────────

interface IssueRowProps {
  issue: JiraIssue;
  storyPointsFieldKey: string;
  onIssueClick: (key: string) => void;
  indented?: boolean;
}

function IssueRow({ issue, storyPointsFieldKey, onIssueClick, indented = false }: IssueRowProps) {
  const issueType = issue.fields.issuetype.name;
  const key = issue.key;
  const summary = issue.fields.summary;
  const rawSp = issue.fields[storyPointsFieldKey];
  const sp = typeof rawSp === 'number' ? rawSp : null;

  return (
    <div className={indented ? 'pl-6 ml-2' : undefined}>
      <button
        type="button"
        className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        onClick={() => onIssueClick(key)}
      >
        <IssueTypeIcon typeName={issueType} className="size-4 shrink-0" />
        <span
          className={cn(
            'text-xs text-muted-foreground font-mono shrink-0',
            doneSummaryClass(issue.fields.status.statusCategory),
          )}
        >
          {key}
        </span>
        <span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
        {sp != null && (
          <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            {sp} pts
          </span>
        )}
        <ProgressBar issue={issue} />
        <CachedAvatar
          url={issue.fields.assignee?.avatarUrls?.['48x48'] ?? null}
          name={issue.fields.assignee?.displayName ?? 'Unassigned'}
          size={20}
          className="shrink-0"
        />
      </button>
    </div>
  );
}

// ─── Nested MR row ────────────────────────────────────────────────────────────

function NestedMrRow({
  mr,
  onMRClick,
}: {
  mr: NestedMr;
  onMRClick: (projectIdAndIid: string) => void;
}) {
  const tag =
    mr.kind === 'review'
      ? 'review'
      : mr.openThreadCount != null && mr.openThreadCount > 0
        ? `${mr.openThreadCount} open thread${mr.openThreadCount !== 1 ? 's' : ''}`
        : 'participating';

  return (
    <div className="pl-6 ml-2">
      <button
        type="button"
        className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        onClick={() => onMRClick(`${mr.projectId}/${mr.iid}`)}
      >
        <GitBranch className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono shrink-0">!{mr.iid}</span>
        <span className="flex-1 min-w-0 truncate text-sm">{mr.title}</span>
        <span className="text-xs text-muted-foreground shrink-0">{tag}</span>
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayUpNextSection({
  rows,
  mrsByStory,
  storyPointsFieldKey,
  isLoading,
  isError,
  error,
  onRetry,
  onIssueClick,
  onMRClick,
}: TodayUpNextSectionProps) {
  const showSkeleton = useDelayedLoading(isLoading);

  // Unlike the other sections, Up Next always renders — an empty "nothing up
  // next" state is meaningful for standup (it confirms there's no queued work).
  return (
    <div className="mb-4 pt-4">
      <StandupSectionHeader
        label="Up Next"
        count={rows.length}
        showZero={!showSkeleton && !isError}
      />

      {showSkeleton ? (
        <LoadingSkeletons />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} viewName="Up Next items" />
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
          <Coffee className="size-4 shrink-0" />
          <span>Nothing up next — enjoy the breather</span>
        </div>
      ) : (
        <div className="[&>*]:py-2">
          {rows.map((row) => (
            <div key={row.issue.key}>
              <IssueRow
                issue={row.issue}
                storyPointsFieldKey={storyPointsFieldKey}
                onIssueClick={onIssueClick}
              />
              {row.subtasks.map((subtask) => (
                <IssueRow
                  key={subtask.key}
                  issue={subtask}
                  storyPointsFieldKey={storyPointsFieldKey}
                  onIssueClick={onIssueClick}
                  indented
                />
              ))}
              {(mrsByStory.get(row.issue.key) ?? []).map((mr) => (
                <NestedMrRow key={`${mr.kind}-${mr.iid}`} mr={mr} onMRClick={onMRClick} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
