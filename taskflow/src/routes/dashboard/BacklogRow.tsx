/**
 * BacklogRow -- A single backlog issue row in the Backlog table.
 *
 * Displays: checkbox (multi-select), issue key (monospace), summary (clickable),
 * story points badge, assignee avatar, and colored epic badge.
 *
 * Epic badge colors now come from Jira's actual epic color field (ghx-label-N),
 * with hash-based fallback for epics missing a Jira color value.
 *
 * Whole row is clickable -- clicking anywhere navigates to story detail.
 * Checkbox onChange and epic badge onClick stop propagation to retain their
 * independent behavior (toggle selection / navigate to epic).
 *
 * When epicsLoading=true and the issue has an epic key, a Skeleton is shown
 * in the epic cell instead of the badge (LOAD-04 progressive loading).
 */
import React from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { epicColorToTailwind } from '@/lib/epicColors';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import { OverdueBadge } from './issue-detail/OverdueBadge';

// -- Props --------------------------------------------------------------------

export interface BacklogRowProps {
  issue: JiraIssue;
  selected: boolean;
  onSelect: (key: string, selected: boolean) => void;
  onIssueClick: (key: string) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  epicNames?: Map<string, string>;
  epicColors?: Map<string, string>;
  isFocused?: boolean;
  epicsLoading?: boolean;
  style?: React.CSSProperties;
}

// -- Component ----------------------------------------------------------------

export const BacklogRow = React.forwardRef<HTMLDivElement, BacklogRowProps>(
  function BacklogRow(
    {
      issue,
      selected,
      onSelect,
      onIssueClick,
      storyPointsFieldKey,
      epicLinkFieldKey,
      epicNameFieldKey,
      epicNames,
      epicColors,
      isFocused,
      epicsLoading,
      style,
    },
    ref,
  ) {
    const epicKey = issue.fields[epicLinkFieldKey] as string | null;
    // Prefer fetched epic name from the epicNames map; fall back to customfield_10015, then key
    const epicName = epicKey
      ? (epicNames?.get(epicKey) ?? (issue.fields[epicNameFieldKey] as string | null) ?? epicKey)
      : null;
    const storyPoints =
      (issue.fields[storyPointsFieldKey] as number | null | undefined) ??
      (issue.fields.customfield_10016 as number | null | undefined) ??
      null;

    // Resolve epic badge color from Jira color map, with hash-based fallback
    const epicColorResult = epicKey
      ? epicColorToTailwind(epicColors?.get(epicKey) ?? null, epicKey)
      : null;

    return (
      <div
        ref={ref}
        data-testid={`backlog-row-${issue.key}`}
        className={cn(
          'grid grid-cols-[32px_96px_auto_1fr_56px_40px] border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
          isFocused && 'bg-muted border-l-2 border-primary',
        )}
        style={style}
        onClick={() => onIssueClick(issue.key)}
        aria-current={isFocused ? 'true' : undefined}
      >
        {/* Checkbox cell — entire cell is click target */}
        <div
          className="w-8 px-3 py-2 density-compact:py-1 density-comfortable:py-3 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(issue.key, !selected);
          }}
        >
          <input
            type="checkbox"
            data-testid={`row-checkbox-${issue.key}`}
            aria-label={issue.key}
            checked={selected}
            readOnly
            className="pointer-events-none"
          />
        </div>

        {/* Key cell */}
        <div className="w-24 px-2 py-2 density-compact:py-1 density-comfortable:py-3 whitespace-nowrap">
          <span className={cn('font-mono text-xs text-muted-foreground', issue.fields.status.statusCategory?.key === 'done' && 'line-through')}>{issue.key}</span>
        </div>

        {/* Epic badge cell — shows Skeleton while epics are loading (LOAD-04) */}
        <div className="px-2 py-2 density-compact:py-1 density-comfortable:py-3 whitespace-nowrap">
          {epicKey ? (
            epicsLoading ? (
              <Skeleton className="h-4 w-14 rounded-full" />
            ) : epicName && epicColorResult ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIssueClick(epicKey);
                }}
                className={cn(
                  'inline-flex items-center rounded-full border px-1.5 py-0 text-[11px] font-medium hover:opacity-80 transition-opacity',
                  epicColorResult.className,
                )}
                style={epicColorResult.style}
                title={`${epicKey}: ${epicName}`}
              >
                {epicName}
              </button>
            ) : null
          ) : null}
        </div>

        {/* Summary cell -- takes remaining space, truncates on overflow */}
        <div className="max-w-0 w-full px-2 py-2 density-compact:py-1 density-comfortable:py-3 overflow-hidden whitespace-nowrap text-ellipsis">
          <span className="inline-flex items-center gap-2 text-sm text-left">
            <span className="truncate">{issue.fields.summary}</span>
            <OverdueBadge
              duedate={(issue.fields.duedate as string | null) ?? null}
              statusCategoryKey={issue.fields.status.statusCategory?.key}
            />
          </span>
        </div>

        {/* Story points cell */}
        <div className="w-14 px-2 py-2 density-compact:py-1 density-comfortable:py-3 text-right">
          {storyPoints !== null ? (
            <span className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
              {storyPoints}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              ?
            </span>
          )}
        </div>

        {/* Assignee cell */}
        <div className="w-10 px-2 py-2 density-compact:py-1 density-comfortable:py-3">
          <CachedAvatar
            url={issue.fields.assignee?.avatarUrls?.['48x48']}
            name={issue.fields.assignee?.displayName || 'Unassigned'}
            size={24}
          />
        </div>
      </div>
    );
  },
);

export default BacklogRow;
