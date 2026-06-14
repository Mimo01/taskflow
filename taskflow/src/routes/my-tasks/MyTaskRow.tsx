/**
 * MyTaskRow — A single issue row in the My Tasks page.
 *
 * Row anatomy:
 *   LEFT region (flex-1 min-w-0): indent spacer (subtask only), type icon,
 *     priority icon (parent only), key, summary, chips (parent only)
 *   RIGHT cluster (shrink-0, identical layout for parent & subtask):
 *     status pill | SP slot (w-12) | time bar (w-36) | avatar
 *
 * Parent and subtask rows share an identical fixed-width right cluster so all
 * right-edge columns align vertically. Subtasks reserve the SP slot as an
 * invisible placeholder of the same width.
 *
 * WebKit/Tauri pitfalls mitigated:
 * - All icon columns have explicit style={{ width, height }} (not Tailwind class)
 * - Time bar column: w-36 (144px) fixed via inline style, never collapses
 * - SP slot: explicit w-12 via inline style, WebKit never collapses it
 * - statusPill wrapped in a flex div (pill needs flex parent for geometry)
 */

import { Flag, Folder } from 'lucide-react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Progress } from '@/components/ui/progress';
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
import { cn } from '@/lib/utils';
import StatusPopover from '@/routes/dashboard/StatusPopover';
import type { JiraIssue } from '@/services/jira';
import { isIssueFlagged } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import type { ReviewHealth } from '@/services/linkEngine';

// ── MR health chip config ─────────────────────────────────────────────────────

const MR_HEALTH_LABEL: Record<ReviewHealth, string> = {
  approved: 'Approved',
  changes_requested: 'Changes requested',
  waiting_for_review: 'Awaiting review',
};

// ── Shared chip geometry ──────────────────────────────────────────────────────
// One size/shape for ALL metadata chips — Flagged, label, MR health.
// Color varies per chip type; layout is always this base class.

const CHIP_BASE =
  'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs shrink-0';

// ── Stacked time bar ──────────────────────────────────────────────────────────

interface StackedTimeBarProps {
  spentSeconds: number;
  totalSeconds: number | undefined;
}

function StackedTimeBar({ spentSeconds, totalSeconds }: StackedTimeBarProps) {
  const hasEst = typeof totalSeconds === 'number' && totalSeconds > 0;
  const hasSpent = spentSeconds > 0;

  // Equal-width spacer so all rows align even when there's no time data
  if (!hasEst && !hasSpent) {
    return <div className="shrink-0" style={{ width: 144 }} aria-hidden />;
  }

  const est = hasEst ? (totalSeconds as number) : 0;
  const fillPct = hasEst ? Math.min(100, Math.round((spentSeconds / est) * 100)) : 0;
  const indicatorColor = hasEst
    ? spentSeconds >= est
      ? 'bg-red-500 rounded-full'
      : fillPct >= 75
        ? 'bg-amber-500 rounded-full'
        : 'bg-green-500 rounded-full'
    : undefined;

  const caption = hasEst
    ? `${formatDuration(spentSeconds)} / ${formatDuration(est)}`
    : formatDuration(spentSeconds);

  return (
    <div className="shrink-0 flex flex-col gap-0.5" style={{ width: 144 }}>
      <Progress
        value={hasEst ? fillPct : 0}
        className="h-1.5 w-full rounded-full"
        indicatorClassName={indicatorColor}
      />
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {caption}
      </span>
    </div>
  );
}

// ── Label chips ───────────────────────────────────────────────────────────────

function LabelChips({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  const visible = labels.slice(0, 2);
  const overflow = labels.length - visible.length;
  return (
    <>
      {visible.map((label) => (
        <span
          key={label}
          className={cn(CHIP_BASE, 'bg-muted text-muted-foreground border-border/60 max-w-[120px]')}
        >
          <Folder className="size-3 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span className={cn(CHIP_BASE, 'bg-muted text-muted-foreground border-border/60')}>
          +{overflow}
        </span>
      )}
    </>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MyTaskRowProps {
  issue: JiraIssue;
  /** When true, renders a lean subtask row indented beneath its parent */
  isSubtask?: boolean;
  jiraBaseUrl: string;
  storyPointsFieldKey: string;
  flaggedFieldKey: string;
  /** Derived MR review health for this issue */
  mrHealth?: ReviewHealth;
  /** Called when the row body is clicked → opens PeekPanel */
  onOpenPeek: (key: string) => void;
  /** Called when the issue key is clicked → full-page detail */
  onOpenIssue: (key: string) => void;
  /** Called when a status transition is selected from StatusPopover */
  onStatusSelect?: (
    transitionId: string,
    toStatusName: string,
    opts?: { resolution: { id: string } | null },
  ) => void;
  /** Subtask rows to render beneath this parent (only for parent rows) */
  subtasks?: JiraIssue[];
  /**
   * Accumulated time-spent across this story + all its subtasks.
   * When provided, the parent row's time bar uses this instead of the issue's own value.
   */
  accumulatedSpentSeconds?: number;
  /**
   * Accumulated original estimate across this story + all its subtasks.
   * When provided, the parent row's time bar uses this instead of the issue's own value.
   */
  accumulatedEstimateSeconds?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MyTaskRow({
  issue,
  isSubtask = false,
  jiraBaseUrl,
  storyPointsFieldKey,
  flaggedFieldKey,
  mrHealth,
  onOpenPeek,
  onOpenIssue,
  onStatusSelect,
  subtasks = [],
  accumulatedSpentSeconds,
  accumulatedEstimateSeconds,
}: MyTaskRowProps) {
  const isFlagged = isIssueFlagged(issue, flaggedFieldKey);
  const statusCategoryKey = issue.fields.status.statusCategory?.key;

  const storyPoints =
    (issue.fields[storyPointsFieldKey] as number | null | undefined) ??
    (issue.fields.customfield_10016 as number | null | undefined) ??
    null;

  const timeTracking = issue.fields.timetracking as
    | {
        timeSpentSeconds?: number;
        remainingEstimateSeconds?: number;
        originalEstimateSeconds?: number;
      }
    | null
    | undefined;

  // For parent rows, use accumulated values when provided (story + all subtasks).
  // For subtask rows (isSubtask=true), always use the issue's own values.
  const totalSeconds =
    !isSubtask && accumulatedEstimateSeconds !== undefined
      ? accumulatedEstimateSeconds
      : timeTracking?.originalEstimateSeconds;
  const spentSeconds =
    !isSubtask && accumulatedSpentSeconds !== undefined
      ? accumulatedSpentSeconds
      : (timeTracking?.timeSpentSeconds ?? 0);

  const labels = (issue.fields.labels as string[] | null | undefined) ?? [];

  const projectId = parseInt(
    (issue.fields.project as { id?: string } | null | undefined)?.id ?? '0',
    10,
  );
  const issueTypeId = (issue.fields.issuetype as { id?: string } | null | undefined)?.id ?? '';

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenPeek(issue.key);
    }
  }

  // ── Shared right cluster ──────────────────────────────────────────────────
  // Identical layout for parent and subtask — columns align perfectly.

  const rightCluster = (
    <div className="flex items-center gap-2 shrink-0">
      {/* Status pill — stopPropagation keeps the click from opening the peek panel */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation wrapper; StatusPopover handles its own keyboard events */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper, not interactive itself */}
      <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
        <StatusPopover
          projectId={projectId}
          issueTypeId={issueTypeId}
          currentStatusId={issue.fields.status.id}
          currentStatus={issue.fields.status.name}
          statusCategoryKey={statusCategoryKey}
          onSelect={(transitionId, toStatusName, opts) =>
            onStatusSelect?.(transitionId, toStatusName, opts)
          }
        />
      </div>

      {/* SP slot — fixed w-12 so WebKit never collapses it.
          Subtask: invisible placeholder preserves column alignment. */}
      <span className="flex shrink-0 items-center justify-center" style={{ width: 48 }}>
        {isSubtask ? (
          // Invisible placeholder — same dimensions as the filled chip
          <span
            className="inline-flex w-7 items-center justify-center rounded-md border border-border/60 bg-muted px-1 py-0.5 text-xs font-medium opacity-0 select-none"
            aria-hidden
          >
            0
          </span>
        ) : storyPoints !== null ? (
          <span className="inline-flex w-7 items-center justify-center rounded-md border border-border/60 bg-muted px-1 py-0.5 text-xs font-medium tabular-nums text-foreground">
            {storyPoints}
          </span>
        ) : (
          <span className="inline-flex w-7 items-center justify-center rounded-md border border-border/60 bg-muted px-1 py-0.5 text-xs font-medium text-muted-foreground/50">
            ?
          </span>
        )}
      </span>

      {/* Stacked time bar — fixed 144px width; consistent track + caption */}
      <StackedTimeBar spentSeconds={spentSeconds} totalSeconds={totalSeconds} />

      {/* Assignee avatar */}
      <CachedAvatar
        url={issue.fields.assignee?.avatarUrls?.['48x48'] ?? null}
        name={issue.fields.assignee?.displayName ?? 'Unassigned'}
        size={24}
        className="ring-1 ring-border shrink-0"
      />
    </div>
  );

  // ── Subtask row ───────────────────────────────────────────────────────────

  if (isSubtask) {
    const subtaskRow = (
      // biome-ignore lint/a11y/useSemanticElements: div[role=button] required — inner key is a <button>, nested buttons are invalid HTML
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onOpenPeek(issue.key)}
        onKeyDown={handleKeyDown}
        data-testid={`my-task-row-${issue.key}`}
      >
        {/* LEFT region */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Indent spacer — aligns subtask type icon under parent priority icon */}
          <span className="shrink-0" style={{ width: 36 }} aria-hidden />

          {/* Issue type icon */}
          <span
            className="flex items-center justify-center shrink-0"
            style={{ width: 16, height: 16 }}
            aria-hidden={!issue.fields.issuetype}
          >
            {issue.fields.issuetype?.name && (
              <IssueTypeIcon typeName={issue.fields.issuetype.name} />
            )}
          </span>

          {/* Issue key */}
          <button
            type="button"
            className={cn(
              'font-mono text-xs text-muted-foreground cursor-pointer hover:underline shrink-0',
              doneSummaryClass(issue.fields.status.statusCategory),
            )}
            onClick={(e) => {
              e.stopPropagation();
              onOpenIssue(issue.key);
            }}
          >
            {issue.key}
          </button>

          {/* Summary — slightly de-emphasised relative to parent */}
          <span
            className={cn(
              'flex-1 min-w-0 truncate text-sm font-normal text-foreground/90',
              doneSummaryClass(issue.fields.status.statusCategory),
            )}
          >
            {issue.fields.summary}
          </span>
        </div>

        {rightCluster}
      </div>
    );

    return subtaskRow;
  }

  // ── Parent row ────────────────────────────────────────────────────────────

  const rowContent = (
    // biome-ignore lint/a11y/useSemanticElements: div[role=button] required — inner key is a <button>, nested buttons are invalid HTML
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isFlagged &&
          'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40',
      )}
      onClick={() => onOpenPeek(issue.key)}
      onKeyDown={handleKeyDown}
      data-testid={`my-task-row-${issue.key}`}
    >
      {/* LEFT region */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Issue type icon */}
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 16, height: 16 }}
          aria-hidden={!issue.fields.issuetype}
        >
          {issue.fields.issuetype?.name && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
        </span>

        {/* Priority icon */}
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 14, height: 14 }}
          aria-hidden={!issue.fields.priority}
        >
          <PriorityIcon
            priority={
              issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined
            }
          />
        </span>

        {/* Issue key */}
        <button
          type="button"
          className={cn(
            'font-mono text-xs text-muted-foreground cursor-pointer hover:underline shrink-0',
            doneSummaryClass(issue.fields.status.statusCategory),
          )}
          onClick={(e) => {
            e.stopPropagation();
            onOpenIssue(issue.key);
          }}
        >
          {issue.key}
        </button>

        {/* Summary */}
        <span
          className={cn(
            'flex-1 min-w-0 truncate text-sm font-medium text-foreground',
            doneSummaryClass(issue.fields.status.statusCategory),
          )}
        >
          {issue.fields.summary}
        </span>

        {/* Metadata chips — subdued so the summary reads first */}

        <LabelChips labels={labels} />

        {isFlagged && (
          <span
            className={cn(
              CHIP_BASE,
              'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
            )}
          >
            <Flag className="size-3 shrink-0" />
            Flagged
          </span>
        )}

        {mrHealth && (
          <span
            className={cn(
              CHIP_BASE,
              mrHealth === 'approved' &&
                'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
              mrHealth === 'changes_requested' &&
                'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
              mrHealth === 'waiting_for_review' &&
                'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
            )}
          >
            {MR_HEALTH_LABEL[mrHealth]}
          </span>
        )}
      </div>

      {rightCluster}
    </div>
  );

  return (
    <>
      {rowContent}

      {/* Subtasks — flat rows indented beneath parent */}
      {subtasks.map((subtask) => (
        <MyTaskRow
          key={subtask.key}
          issue={subtask}
          isSubtask
          jiraBaseUrl={jiraBaseUrl}
          storyPointsFieldKey={storyPointsFieldKey}
          flaggedFieldKey={flaggedFieldKey}
          onOpenPeek={onOpenPeek}
          onOpenIssue={onOpenIssue}
          onStatusSelect={onStatusSelect}
        />
      ))}
    </>
  );
}

export default MyTaskRow;
