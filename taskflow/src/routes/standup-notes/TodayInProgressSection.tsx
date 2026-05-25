/**
 * TodayInProgressSection — In Progress rows in the Today column.
 *
 * Renders the user's sprint items with statusCategory.key === 'indeterminate'.
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

import { GitBranch } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Progress } from '@/components/ui/progress';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { formatDuration } from '@/services/jira/duration';
import type { JiraIssue } from '@/services/jira';
import { LogWorkPopover } from '@/routes/dashboard/issue-detail/LogWorkPopover';
import type { SprintRow } from './filterSprintItems';
import type { NestedMr } from './mrMatching';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TodayInProgressSectionProps {
  rows: SprintRow[];
  mrsByStory: Map<string, NestedMr[]>;
  todayLoggedByIssue: Map<string, number>;
  storyPointsFieldKey: string;
  jiraBaseUrl: string;
  todayStr: string;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  onIssueClick: (key: string) => void;
  onMRClick: (projectIdAndIid: string) => void;
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

  return (
    <div className="px-2 pb-2">
      <Progress value={fillPct} className="max-w-[180px]" />
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {formatDuration(spentSec)} / {formatDuration(originalSec)} logged
      </p>
    </div>
  );
}

// ─── Issue row (reused for parent and subtask) ────────────────────────────────

interface IssueRowProps {
  issue: JiraIssue;
  todayLoggedByIssue: Map<string, number>;
  storyPointsFieldKey: string;
  jiraBaseUrl: string;
  todayStr: string;
  onIssueClick: (key: string) => void;
  onLogWorkSuccess: () => void;
  indented?: boolean;
}

function IssueRow({
  issue,
  todayLoggedByIssue,
  storyPointsFieldKey,
  jiraBaseUrl,
  todayStr,
  onIssueClick,
  onLogWorkSuccess,
  indented = false,
}: IssueRowProps) {
  const issueType = issue.fields.issuetype.name;
  const key = issue.key;
  const summary = issue.fields.summary;
  const sp = issue.fields[storyPointsFieldKey] as number | null;
  const loggedSeconds = todayLoggedByIssue.get(key) ?? 0;

  return (
    <div className={indented ? 'pl-6 border-l border-border ml-2' : undefined}>
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        onClick={() => onIssueClick(key)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) onIssueClick(key);
        }}
      >
        <IssueTypeIcon typeName={issueType} className="size-4 shrink-0" />
        <span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
        <span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
        {sp != null && (
          <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            {sp} pts
          </span>
        )}
        <CachedAvatar
          url={issue.fields.assignee?.avatarUrls?.['48x48'] ?? null}
          name={issue.fields.assignee?.displayName ?? 'Unassigned'}
          size={20}
          className="shrink-0"
        />
        {loggedSeconds > 0 && (
          <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground ml-1">
            {formatDuration(loggedSeconds)}
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
      </div>
      <ProgressBar issue={issue} />
    </div>
  );
}

// ─── Nested MR row ────────────────────────────────────────────────────────────

function NestedMrRow({ mr, onMRClick }: { mr: NestedMr; onMRClick: (projectIdAndIid: string) => void }) {
  const tag =
    mr.kind === 'review'
      ? 'review'
      : mr.openThreadCount != null && mr.openThreadCount > 0
        ? `${mr.openThreadCount} open thread${mr.openThreadCount !== 1 ? 's' : ''}`
        : 'participating';

  return (
    <div className="pl-6 border-l border-border ml-2">
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        onClick={() => onMRClick(`${mr.projectId}/${mr.iid}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onMRClick(`${mr.projectId}/${mr.iid}`);
        }}
      >
        <GitBranch className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono shrink-0">!{mr.iid}</span>
        <span className="flex-1 min-w-0 truncate text-sm">{mr.title}</span>
        <span className="text-xs text-muted-foreground shrink-0">{tag}</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayInProgressSection({
  rows,
  mrsByStory,
  todayLoggedByIssue,
  storyPointsFieldKey,
  jiraBaseUrl,
  todayStr,
  isLoading,
  isError,
  error,
  onRetry,
  onIssueClick,
  onMRClick,
  onLogWorkSuccess,
}: TodayInProgressSectionProps) {
  const showSkeleton = useDelayedLoading(isLoading);

  // D-03: hidden when empty + settled
  if (!isLoading && !showSkeleton && !isError && rows.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wide">IN PROGRESS</h3>
        {rows.length > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{rows.length}</span>
        )}
      </div>

      {showSkeleton ? (
        <LoadingSkeletons />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} viewName="In Progress items" />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.issue.key}>
              <IssueRow
                issue={row.issue}
                todayLoggedByIssue={todayLoggedByIssue}
                storyPointsFieldKey={storyPointsFieldKey}
                jiraBaseUrl={jiraBaseUrl}
                todayStr={todayStr}
                onIssueClick={onIssueClick}
                onLogWorkSuccess={onLogWorkSuccess}
              />
              {row.subtasks.map((subtask) => (
                <IssueRow
                  key={subtask.key}
                  issue={subtask}
                  todayLoggedByIssue={todayLoggedByIssue}
                  storyPointsFieldKey={storyPointsFieldKey}
                  jiraBaseUrl={jiraBaseUrl}
                  todayStr={todayStr}
                  onIssueClick={onIssueClick}
                  onLogWorkSuccess={onLogWorkSuccess}
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
