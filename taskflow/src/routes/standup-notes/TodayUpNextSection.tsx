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
 * Each row (parent + subtask) shows the shared IssueTimeBar (same as My Tasks):
 * epic-style time bar, tooltip has the breakdown; rows with no time data still
 * show an empty track.
 *
 * Section degrades per D-03: skeleton while loading, ErrorState on error,
 * returns null (hidden) when 0 rows + not loading + not erroring.
 */

import { Coffee, GitBranch } from 'lucide-react';
import { IssueTimeBar, timedIssueOwn } from '@/components/jira/IssueTimeBar';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { ErrorState } from '@/components/ui/error-state';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
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
  onOpenIssue?: (key: string) => void;
  onMRClick: (projectIdAndIid: string) => void;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeletons() {
  return (
    <div className="flex flex-col gap-2 density-compact:gap-1 density-comfortable:gap-3 py-2 density-compact:py-1 density-comfortable:py-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

// Today column is ~half the page: narrower bar, hidden only when the column is cramped.
const TODAY_TIME_BAR_WIDTH_CLASS = 'w-24 @max-[30rem]:hidden';

// ─── Issue row (reused for parent and subtask) ────────────────────────────────

interface IssueRowProps {
  issue: JiraIssue;
  storyPointsFieldKey: string;
  onIssueClick: (key: string) => void;
  onOpenIssue?: (key: string) => void;
  indented?: boolean;
  /** Reserve the story-points slot (some row in this section has points). */
  showSp: boolean;
  /** Parent rows: my nested subtasks, whose time is added to the story's bar. */
  subtasks?: JiraIssue[];
  /** All of the story's subtasks (not just mine) for the time bar. */
  timeSubtasks?: JiraIssue[];
}

function IssueRow({
  issue,
  storyPointsFieldKey,
  onIssueClick,
  onOpenIssue,
  indented = false,
  showSp,
  subtasks = [],
  timeSubtasks = subtasks,
}: IssueRowProps) {
  const rollsUp = timeSubtasks.length > 0;
  const issueType = issue.fields.issuetype.name;
  const key = issue.key;
  const summary = issue.fields.summary;
  const rawSp = issue.fields[storyPointsFieldKey];
  const sp = typeof rawSp === 'number' ? rawSp : null;

  const handleBody = () => (onOpenIssue ?? onIssueClick)(key);

  return (
    <div className={indented ? 'pl-6 ml-2' : undefined}>
      {/* biome-ignore lint/a11y/useSemanticElements: div[role=button] required — inner key is a <button>, nested buttons are invalid HTML (D-10 / Pitfall 1) */}
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-2 rounded px-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        onClick={handleBody}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBody();
          }
        }}
      >
        <IssueTypeIcon typeName={issueType} className="size-4 shrink-0" />
        {/* PEEK-05: key button navigates full-page; stopPropagation prevents body onOpenIssue */}
        <button
          type="button"
          className={cn(
            'text-xs text-muted-foreground font-mono shrink-0 cursor-pointer hover:underline',
            doneSummaryClass(issue.fields.status.statusCategory),
          )}
          onClick={(e) => {
            e.stopPropagation();
            onIssueClick(key);
          }}
        >
          {key}
        </button>
        <span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
        {/* Trailing cluster never shrinks; fixed-width slots keep pills/columns aligned
            between rows that do and don't have story points or an estimate. */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex shrink-0">
            <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
              {issue.fields.status.name}
            </span>
          </div>
          {showSp && (
            <div className="flex min-w-7 shrink-0 justify-end">
              <span
                className={cn(
                  'inline-flex min-w-7 justify-center rounded border border-border bg-muted px-1 py-0.5 text-xs font-medium text-muted-foreground',
                  sp == null && 'invisible',
                )}
                aria-hidden={sp == null}
              >
                {sp ?? 0}
              </span>
            </div>
          )}
          <IssueTimeBar
            colorBy={rollsUp ? 'status' : 'health'}
            issue={
              rollsUp
                ? [timedIssueOwn(issue), ...timeSubtasks.map(timedIssueOwn)]
                : timedIssueOwn(issue)
            }
            className={TODAY_TIME_BAR_WIDTH_CLASS}
            testId="standup-time-bar"
          />
          <CachedAvatar
            url={issue.fields.assignee?.avatarUrls?.['48x48'] ?? null}
            name={issue.fields.assignee?.displayName ?? 'Unassigned'}
            size={20}
            className="shrink-0"
          />
        </div>
      </div>
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
        className="w-full text-left flex items-center gap-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
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
  onOpenIssue,
  onMRClick,
}: TodayUpNextSectionProps) {
  const showSkeleton = useDelayedLoading(isLoading);

  // Fixed-width trailing slots are reserved only when some row in the section uses them,
  // so the pill column stays aligned without wasting width on empty columns.
  const sectionIssues = rows.flatMap((r) => [r.issue, ...r.subtasks]);
  const showSp = sectionIssues.some((i) => typeof i.fields[storyPointsFieldKey] === 'number');

  // Unlike the other sections, Up Next always renders — an empty "nothing up
  // next" state is meaningful for standup (it confirms there's no queued work).
  return (
    <div>
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
        <div className="flex items-center gap-2 px-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5 text-sm text-muted-foreground">
          <Coffee className="size-4 shrink-0" />
          <span>Nothing up next — enjoy the breather</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 density-compact:gap-0.5 density-comfortable:gap-2">
          {rows.map((row) => (
            <div key={row.issue.key}>
              <IssueRow
                issue={row.issue}
                storyPointsFieldKey={storyPointsFieldKey}
                onIssueClick={onIssueClick}
                onOpenIssue={onOpenIssue}
                showSp={showSp}
                subtasks={row.subtasks}
                timeSubtasks={row.allSubtasks ?? row.subtasks}
              />
              {row.subtasks.map((subtask) => (
                <IssueRow
                  key={subtask.key}
                  issue={subtask}
                  storyPointsFieldKey={storyPointsFieldKey}
                  onIssueClick={onIssueClick}
                  onOpenIssue={onOpenIssue}
                  indented
                  showSp={showSp}
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
