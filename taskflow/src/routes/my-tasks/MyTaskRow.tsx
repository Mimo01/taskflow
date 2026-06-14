/**
 * MyTaskRow — A single issue row in the My Tasks page (redesigned for 82-DESIGN-TARGET).
 *
 * Row anatomy (parent):
 *   LEFT region (flex-1 min-w-0): indent/chevron, icons, key, summary, chips
 *   RIGHT cluster (shrink-0): status pill | SP slot | time bar | avatar
 *
 * Parent and subtask rows share an IDENTICAL fixed-width right cluster so all
 * right-edge columns line up vertically. Subtasks reserve the SP slot as an
 * empty placeholder (same width, invisible).
 *
 * WebKit/Tauri pitfalls mitigated:
 * - All icon columns have explicit style={{ width, height }}
 * - Time bar column uses w-36 (144px) fixed, never collapses
 * - SP slot uses explicit w-12 so WebKit never collapses it
 * - statusPill wrapped in flex div (statusPill needs flex parent for geometry)
 */

import { ChevronDown, ChevronRight, Flag, Folder } from 'lucide-react';
import { useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
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

const MR_HEALTH_CLASS: Record<ReviewHealth, string> = {
  approved: 'bg-green-500/15 text-green-700 dark:text-green-400',
  changes_requested: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  waiting_for_review: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
};

// ── Stacked time bar ──────────────────────────────────────────────────────────

interface StackedTimeBarProps {
  spentSeconds: number;
  totalSeconds: number | undefined;
}

function StackedTimeBar({ spentSeconds, totalSeconds }: StackedTimeBarProps) {
  const hasEst = typeof totalSeconds === 'number' && totalSeconds > 0;
  const hasSpent = spentSeconds > 0;

  if (!hasEst && !hasSpent) {
    // Equal-width spacer so all rows align
    return <div className="shrink-0" style={{ width: 144 }} aria-hidden />;
  }

  const est = hasEst ? (totalSeconds as number) : 0;
  const fillPct = hasEst ? Math.min(100, Math.round((spentSeconds / est) * 100)) : 0;
  const indicatorColor = hasEst
    ? spentSeconds >= est
      ? 'bg-red-500'
      : fillPct >= 75
        ? 'bg-amber-500'
        : 'bg-green-500'
    : undefined;

  const caption = hasEst
    ? `${formatDuration(spentSeconds)} / ${formatDuration(est)}`
    : hasSpent
      ? formatDuration(spentSeconds)
      : '0m / —';

  return (
    <div className="shrink-0 flex flex-col gap-0.5" style={{ width: 144 }}>
      <Progress
        value={hasEst ? fillPct : 0}
        className="h-1.5 w-full"
        indicatorClassName={indicatorColor}
      />
      <span className="text-xs text-muted-foreground tabular-nums font-mono whitespace-nowrap">
        {caption}
      </span>
    </div>
  );
}

// ── Label chips (folder icon + text, max 2 + overflow badge) ─────────────────

function LabelChips({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  const visible = labels.slice(0, 2);
  const overflow = labels.length - visible.length;
  return (
    <>
      {visible.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground shrink-0 max-w-[120px]"
        >
          <Folder className="size-3 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground shrink-0">
          +{overflow}
        </span>
      )}
    </>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MyTaskRowProps {
  issue: JiraIssue;
  /** When true, renders a lean subtask row indented with IssueTypeIcon */
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
}: MyTaskRowProps) {
  const [logWorkOpen, setLogWorkOpen] = useState(false);
  // Local collapse state: true = subtasks hidden
  const [collapsed, setCollapsed] = useState(false);

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
  const totalSeconds = timeTracking?.originalEstimateSeconds;
  const spentSeconds = timeTracking?.timeSpentSeconds ?? 0;

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

  // ── Subtask row (lean, indented with IssueTypeIcon) ───────────────────────

  if (isSubtask) {
    const subtaskRow = (
      // biome-ignore lint/a11y/useSemanticElements: div[role=button] required — inner key is a <button>, nested buttons are invalid HTML
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => onOpenPeek(issue.key)}
        onKeyDown={handleKeyDown}
        data-testid={`my-task-row-${issue.key}`}
      >
        {/* LEFT region: indent spacer + issue type icon + key + summary */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Indent spacer (replaces chevron + type + priority slots of parent) */}
          <span className="shrink-0" style={{ width: 52 }} aria-hidden />

          {/* Issue type icon (sub-task type) */}
          <span
            className="flex items-center justify-center shrink-0"
            style={{ width: 18, height: 18 }}
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

          {/* Summary */}
          <span
            className={cn(
              'flex-1 min-w-0 truncate text-sm',
              doneSummaryClass(issue.fields.status.statusCategory),
            )}
          >
            {issue.fields.summary}
          </span>
        </div>

        {/* RIGHT cluster: identical fixed-width slots as parent row */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Status pill slot */}
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

          {/* SP placeholder slot — same width as parent SP slot, invisible */}
          <span
            className="shrink-0 tabular-nums whitespace-nowrap opacity-0 select-none"
            style={{ width: 48 }}
            aria-hidden
          >
            — pts
          </span>

          {/* Stacked time bar */}
          <StackedTimeBar spentSeconds={spentSeconds} totalSeconds={totalSeconds} />

          {/* Assignee avatar */}
          <CachedAvatar
            url={issue.fields.assignee?.avatarUrls?.['48x48'] ?? null}
            name={issue.fields.assignee?.displayName ?? 'Unassigned'}
            size={24}
          />
        </div>
      </div>
    );

    return (
      <ContextMenu>
        <ContextMenuTrigger render={subtaskRow} />
        <ContextMenuContent>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(issue.key).catch(() => {});
            }}
          >
            Copy issue key
          </ContextMenuItem>
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
      </ContextMenu>
    );
  }

  // ── Parent row ────────────────────────────────────────────────────────────

  const hasSubtasks = subtasks.length > 0;

  const rowContent = (
    // biome-ignore lint/a11y/useSemanticElements: div[role=button] required — inner key is a <button>, nested buttons are invalid HTML
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors',
        isFlagged &&
          'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40',
      )}
      onClick={() => onOpenPeek(issue.key)}
      onKeyDown={handleKeyDown}
      data-testid={`my-task-row-${issue.key}`}
    >
      {/* LEFT region: chevron + icons + key + summary + chips */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* 1. Expand/collapse chevron — only when subtasks exist */}
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 16, height: 16 }}
          aria-hidden
        >
          {hasSubtasks && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground cursor-pointer p-0 border-0 bg-transparent"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((c) => !c);
              }}
              aria-label={collapsed ? 'Expand subtasks' : 'Collapse subtasks'}
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
        </span>

        {/* 2. Issue type icon */}
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 18, height: 18 }}
          aria-hidden={!issue.fields.issuetype}
        >
          {issue.fields.issuetype?.name && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
        </span>

        {/* 3. Priority icon */}
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 18, height: 18 }}
          aria-hidden={!issue.fields.priority}
        >
          <PriorityIcon
            priority={
              issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined
            }
          />
        </span>

        {/* 4. Issue key */}
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

        {/* 5. Summary */}
        <span
          className={cn(
            'flex-1 min-w-0 truncate text-sm',
            doneSummaryClass(issue.fields.status.statusCategory),
          )}
        >
          {isFlagged && (
            <Flag className="inline size-3.5 text-yellow-700 dark:text-yellow-300 mr-1 shrink-0" />
          )}
          {issue.fields.summary}
        </span>

        {/* 6. Metadata chips */}

        {/* N sub */}
        {(issue.fields.subtasks as unknown[] | null | undefined)?.length ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground shrink-0 tabular-nums">
            {(issue.fields.subtasks as unknown[]).length} sub
          </span>
        ) : null}

        {/* Flagged chip */}
        {isFlagged && (
          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs bg-red-500/15 text-red-700 dark:text-red-400 shrink-0">
            <Flag className="size-3" />
            Flagged
          </span>
        )}

        {/* Label chips */}
        <LabelChips labels={labels} />

        {/* MR health chip */}
        {mrHealth && (
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-xs shrink-0',
              MR_HEALTH_CLASS[mrHealth],
            )}
          >
            {MR_HEALTH_LABEL[mrHealth]}
          </span>
        )}
      </div>

      {/* RIGHT cluster: fixed-width slots — identical layout for parent and subtask */}
      <div className="flex items-center gap-3 shrink-0">
        {/* 7. Status pill slot */}
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

        {/* 8. Story points slot — fixed w-12 so WebKit never collapses it */}
        {storyPoints !== null ? (
          <span
            className="text-xs text-muted-foreground shrink-0 tabular-nums whitespace-nowrap text-right"
            style={{ width: 48 }}
          >
            {storyPoints} pts
          </span>
        ) : (
          <span
            className="text-xs text-muted-foreground shrink-0 tabular-nums whitespace-nowrap opacity-0 select-none"
            style={{ width: 48 }}
            aria-hidden
          >
            — pts
          </span>
        )}

        {/* 9. Stacked time bar */}
        <StackedTimeBar spentSeconds={spentSeconds} totalSeconds={totalSeconds} />

        {/* 10. Assignee avatar */}
        <CachedAvatar
          url={issue.fields.assignee?.avatarUrls?.['48x48'] ?? null}
          name={issue.fields.assignee?.displayName ?? 'Unassigned'}
          size={24}
        />
      </div>
    </div>
  );

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger render={rowContent} />
        <ContextMenuContent>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setLogWorkOpen(true);
            }}
          >
            Log Work
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(issue.key).catch(() => {});
            }}
          >
            Copy issue key
          </ContextMenuItem>
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

        {logWorkOpen && (
          <LogWorkPopover
            issueKey={issue.key}
            jiraBaseUrl={jiraBaseUrl}
            onSuccess={() => setLogWorkOpen(false)}
          />
        )}
      </ContextMenu>

      {/* Subtasks — collapsed when the chevron is toggled */}
      {!collapsed &&
        subtasks.map((subtask) => (
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
    </div>
  );
}

export default MyTaskRow;
