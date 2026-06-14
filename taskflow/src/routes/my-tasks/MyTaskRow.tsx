/**
 * MyTaskRow — A single issue row in the My Tasks page.
 *
 * Full row anatomy per MYTASK-05 (UI-SPEC §Row Anatomy):
 *   1. Type icon (18×18px explicit style — WebKit 0-width column fix)
 *   2. Issue key (font-mono, inner <button> with stopPropagation → full-page detail)
 *   3. Priority icon (18×18px explicit style)
 *   4. Summary (text-sm truncate, Flag icon when flagged, OverdueBadge when overdue)
 *   5. Status pill (statusPillClass() wrapped in flex div, click → StatusPopover)
 *   6. Due date (text-xs, text-destructive when overdue)
 *   7. Story points badge (inline-flex w-7, ? when null)
 *   8. MR health badge (Badge, when mrHealth provided)
 *   9. Time logged/remaining bar (Progress, when time data available)
 *
 * Inline interactions per MYTASK-06 (D-07, D-08):
 *   - Row body click → onOpenPeek (PeekPanel)
 *   - Issue-key button → onOpenIssue (full-page detail), sibling with stopPropagation
 *   - Status pill click → StatusPopover (inline transition)
 *   - Right-click context menu → "Log Work", "Copy issue key", "Copy link" (D-07 only)
 *
 * Subtask indent: pl-8 when isSubtask=true (D-03)
 * Flagged row: bg-yellow-100 dark:bg-yellow-900/30 (BacklogRow pattern)
 */

import { Flag } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Progress } from '@/components/ui/progress';
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
import { cn } from '@/lib/utils';
import { LogWorkPopover } from '@/routes/dashboard/issue-detail/LogWorkPopover';
import { isOverdue, OverdueBadge } from '@/routes/dashboard/issue-detail/OverdueBadge';
import StatusPopover from '@/routes/dashboard/StatusPopover';
import type { JiraIssue } from '@/services/jira';
import { isIssueFlagged } from '@/services/jira';
import type { ReviewHealth } from '@/services/linkEngine';

// MR health badge tone mapping
const MR_HEALTH_TONE: Record<ReviewHealth, 'green' | 'orange' | 'blue'> = {
  approved: 'green',
  changes_requested: 'orange',
  waiting_for_review: 'blue',
};

const MR_HEALTH_LABEL: Record<ReviewHealth, string> = {
  approved: 'Approved',
  changes_requested: 'Changes',
  waiting_for_review: 'In Review',
};

export interface MyTaskRowProps {
  issue: JiraIssue;
  /** When true, applies pl-8 subtask indent (D-03) */
  isSubtask?: boolean;
  jiraBaseUrl: string;
  storyPointsFieldKey: string;
  flaggedFieldKey: string;
  /** MR health badge — shown only when provided */
  mrHealth?: ReviewHealth;
  /** Called when the row body is clicked → opens PeekPanel (D-08) */
  onOpenPeek: (key: string) => void;
  /** Called when the issue key is clicked → full-page detail (D-08) */
  onOpenIssue: (key: string) => void;
  /** Called when a status transition is selected from StatusPopover */
  onStatusSelect?: (
    transitionId: string,
    toStatusName: string,
    opts?: { resolution: { id: string } | null },
  ) => void;
}

export function MyTaskRow({
  issue,
  isSubtask,
  jiraBaseUrl,
  storyPointsFieldKey,
  flaggedFieldKey,
  mrHealth,
  onOpenPeek,
  onOpenIssue,
  onStatusSelect,
}: MyTaskRowProps) {
  const [logWorkOpen, setLogWorkOpen] = useState(false);

  const isFlagged = isIssueFlagged(issue, flaggedFieldKey);
  const duedate = (issue.fields.duedate as string | null | undefined) ?? null;
  const statusCategoryKey = issue.fields.status.statusCategory?.key;
  const isOverdueIssue = isOverdue(duedate, statusCategoryKey);

  const storyPoints =
    (issue.fields[storyPointsFieldKey] as number | null | undefined) ??
    (issue.fields.customfield_10016 as number | null | undefined) ??
    null;

  // Time tracking — Progress shown when originalEstimateSeconds > 0
  const timeTracking = issue.fields.timetracking as
    | {
        timeSpentSeconds?: number;
        remainingEstimateSeconds?: number;
        originalEstimateSeconds?: number;
      }
    | null
    | undefined;
  const totalSeconds = timeTracking?.originalEstimateSeconds;
  const spentSeconds = timeTracking?.timeSpentSeconds ?? 0;
  const timeProgressValue =
    totalSeconds && totalSeconds > 0
      ? Math.min(100, Math.round((spentSeconds / totalSeconds) * 100))
      : null;

  // StatusPopover props
  const projectId = parseInt(
    (issue.fields.project as { id?: string } | null | undefined)?.id ?? '0',
    10,
  );
  const issueTypeId = (issue.fields.issuetype as { id?: string } | null | undefined)?.id ?? '';

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenPeek(issue.key);
    }
  }

  const rowBase = cn(
    'flex items-center gap-2 px-4 py-2 border-b border-border cursor-pointer hover:bg-muted/30 transition-colors',
    isSubtask && 'pl-8',
    isFlagged &&
      'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40',
  );

  const rowContent = (
    <div
      role="button"
      tabIndex={0}
      className={rowBase}
      onClick={() => onOpenPeek(issue.key)}
      onKeyDown={handleKeyDown}
      data-testid={`my-task-row-${issue.key}`}
    >
      {/* 1. Type icon — 18×18 explicit px (WebKit column fix) */}
      <span
        className="flex items-center justify-center shrink-0"
        style={{ width: 18, height: 18 }}
        aria-hidden={!issue.fields.issuetype}
      >
        {issue.fields.issuetype?.name && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
      </span>

      {/* 2. Issue key — sibling <button> with stopPropagation (overlay-button pattern) */}
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

      {/* 3. Priority icon — 18×18 explicit px */}
      <span
        className="flex items-center justify-center shrink-0"
        style={{ width: 18, height: 18 }}
        aria-hidden={!issue.fields.priority}
      >
        <PriorityIcon
          priority={issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined}
        />
      </span>

      {/* 4. Summary — truncates, flag icon + OverdueBadge */}
      <span className="flex items-center gap-1.5 min-w-0 flex-1 text-sm">
        {isFlagged && <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />}
        <span className={cn('truncate', doneSummaryClass(issue.fields.status.statusCategory))}>
          {issue.fields.summary}
        </span>
        <OverdueBadge duedate={duedate} statusCategoryKey={statusCategoryKey} />
      </span>

      {/* 5. Status pill — wrapped in flex div (memory project_statuspill_needs_flex_parent).
          StatusPopover renders its own PopoverTrigger with statusPillClass; the flex div
          prevents the pill from collapsing on a bare inline span. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation wrapper, inner StatusPopover handles its own keyboard events */}
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

      {/* 6. Due date — text-destructive when overdue */}
      {duedate && (
        <span
          className={cn(
            'text-xs shrink-0',
            isOverdueIssue ? 'text-destructive' : 'text-muted-foreground',
          )}
          aria-label={isOverdueIssue ? `Due ${duedate}, overdue` : `Due ${duedate}`}
        >
          {duedate}
        </span>
      )}

      {/* 7. Story points badge */}
      <span className="inline-flex w-7 items-center justify-center rounded border border-border bg-muted px-1 py-0.5 text-xs font-medium shrink-0">
        {storyPoints !== null ? (
          <span className="text-foreground">{storyPoints}</span>
        ) : (
          <span className="text-muted-foreground">?</span>
        )}
      </span>

      {/* 8. MR health badge — only when mrHealth is provided */}
      {mrHealth && (
        <Badge tone={MR_HEALTH_TONE[mrHealth]} className="shrink-0">
          {MR_HEALTH_LABEL[mrHealth]}
        </Badge>
      )}

      {/* 9. Time logged/remaining bar — only when time data available */}
      {timeProgressValue !== null && (
        <div className="w-16 shrink-0">
          <Progress value={timeProgressValue} />
        </div>
      )}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger render={rowContent} />
      <ContextMenuContent>
        {/* Log Work — opens LogWorkPopover (D-07) */}
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            setLogWorkOpen(true);
          }}
        >
          Log Work
        </ContextMenuItem>
        {/* Copy issue key (D-07) */}
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(issue.key).catch(() => {});
          }}
        >
          Copy issue key
        </ContextMenuItem>
        {/* Copy link (D-07) */}
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard
              .writeText(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issue.key}`)
              .catch(() => {});
          }}
        >
          Copy link
        </ContextMenuItem>
      </ContextMenuContent>

      {/* LogWorkPopover rendered outside the context menu to avoid nesting issues */}
      {logWorkOpen && (
        <LogWorkPopover
          issueKey={issue.key}
          jiraBaseUrl={jiraBaseUrl}
          onSuccess={() => setLogWorkOpen(false)}
        />
      )}
    </ContextMenu>
  );
}

export default MyTaskRow;
