/**
 * BacklogRow -- A single backlog issue row in the Backlog table.
 *
 * Displays: issue key (monospace), summary (clickable),
 * story points badge, assignee avatar, and colored epic badge.
 *
 * Epic badge colors now come from Jira's actual epic color field (ghx-label-N),
 * with hash-based fallback for epics missing a Jira color value.
 *
 * Whole row is clickable -- clicking anywhere navigates to story detail.
 * Right-click opens a context menu with "Move to sprint" options (when onMoveToSprint provided).
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Flag } from 'lucide-react';
import React from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { SprintMoveMenuItems } from '@/components/ui/sprint-move-menu-items';
import { epicColorToTailwind } from '@/lib/epicColors';
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import { OverdueBadge } from './issue-detail/OverdueBadge';

// -- Props --------------------------------------------------------------------

export interface BacklogRowProps {
  issue: JiraIssue;
  onIssueClick: (key: string) => void;
  /** Phase 77 Plan 04 (PEEK-01): clicking the row body opens the peek panel. */
  onOpenIssue?: (key: string) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  epicNames?: Map<string, string>;
  epicColors?: Map<string, string>;
  epicsLoading?: boolean;
  isFocused?: boolean;
  sprints?: Array<{ id: number; name: string; state: string }>;
  onMoveToSprint?: (issueKey: string, sprintId: number, sprintName: string) => void;
  onMoveToBacklog?: (issueKey: string) => void;
  /** Whether this issue is currently flagged as an impediment */
  isFlagged?: boolean;
  /** Called when user selects Flag/Unflag from the context menu */
  onToggleFlag?: (issueKey: string) => void;
  /** Set true while the row is in the DragOverlay ghost — suppresses sortable hook */
  isOverlay?: boolean;
  /** Passed from parent when justDragged guard is active */
  justDragged?: React.MutableRefObject<boolean>;
}

// -- Row cells (shared between both render paths) ----------------------------

function RowCells({
  issue,
  epicKey,
  epicName,
  epicColorResult,
  storyPoints,
  onIssueClick,
  epicsLoading,
  isFlagged,
}: {
  issue: JiraIssue;
  epicKey: string | null;
  epicName: string | null;
  epicColorResult: ReturnType<typeof epicColorToTailwind> | null;
  storyPoints: number | null;
  onIssueClick: (key: string) => void;
  epicsLoading?: boolean;
  isFlagged?: boolean;
}) {
  return (
    <>
      {/* Key cell — PEEK-05: inner button navigates full-page, stopPropagation prevents row onOpenIssue */}
      <td className="relative w-24 px-2 py-2 density-compact:py-1 density-comfortable:py-3 whitespace-nowrap">
        <button
          type="button"
          className={cn(
            'font-mono text-xs text-muted-foreground cursor-pointer hover:underline',
            doneSummaryClass(issue.fields.status.statusCategory),
          )}
          onClick={(e) => {
            e.stopPropagation();
            onIssueClick(issue.key);
          }}
        >
          {issue.key}
        </button>
      </td>

      {/* Summary cell -- takes remaining space, truncates on overflow */}
      <td className="max-w-0 w-full px-2 py-2 density-compact:py-1 density-comfortable:py-3 overflow-hidden whitespace-nowrap text-ellipsis">
        <span className="inline-flex items-center gap-2 text-sm text-left">
          {isFlagged && <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />}
          <span className="truncate">{issue.fields.summary}</span>
          <OverdueBadge
            duedate={(issue.fields.duedate as string | null) ?? null}
            statusCategoryKey={issue.fields.status.statusCategory?.key}
          />
        </span>
      </td>

      {/* Epic badge cell -- right-aligned, before Points column.
          max-w caps the column so a long epic name can't steal width from
          the Summary column under the table's auto layout; the badge label
          truncates instead. */}
      <td className="max-w-[12rem] px-2 py-2 density-compact:py-1 density-comfortable:py-3 whitespace-nowrap text-right">
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
                'inline-flex max-w-full items-center overflow-hidden rounded border px-1.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity',
                epicColorResult.className,
              )}
              style={epicColorResult.style}
              title={`${epicKey}: ${epicName}`}
            >
              <span className="truncate">{epicName}</span>
            </button>
          ) : null
        ) : null}
      </td>

      {/* Story points cell */}
      <td className="w-14 px-2 py-2 density-compact:py-1 density-comfortable:py-3 text-right">
        {storyPoints !== null ? (
          <span className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
            {storyPoints}
          </span>
        ) : (
          <span className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            ?
          </span>
        )}
      </td>

      {/* Assignee cell */}
      <td className="w-10 px-2 py-2 density-compact:py-1 density-comfortable:py-3">
        <CachedAvatar
          url={issue.fields.assignee?.avatarUrls['48x48'] || null}
          name={issue.fields.assignee?.displayName || 'Unassigned'}
          size={24}
        />
      </td>
    </>
  );
}

// -- Component ----------------------------------------------------------------

export const BacklogRow = React.forwardRef<HTMLTableRowElement, BacklogRowProps>(
  function BacklogRow(
    {
      issue,
      onIssueClick,
      onOpenIssue,
      storyPointsFieldKey,
      epicLinkFieldKey,
      epicNameFieldKey,
      epicNames,
      epicColors,
      epicsLoading,
      isFocused,
      sprints,
      onMoveToSprint,
      onMoveToBacklog,
      isFlagged,
      onToggleFlag,
      isOverlay,
      justDragged,
    },
    _ref,
  ) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: issue.key,
      disabled: isOverlay,
    });

    const dragStyle: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      // D-07 (ghost placeholder model): the dragged item is live-reordered into
      // its drop slot in localOrder, so its in-list row IS the drop position.
      // Instead of hiding it (opacity 0) we render it as a translucent ghost
      // placeholder (see ghostPlaceholderClass below) so the user sees exactly
      // where the issue will land — Trello/Jira style. The solid clone floats in
      // the DragOverlay. Identical treatment for intra- AND cross-section drags.
      cursor: isDragging ? 'grabbing' : 'grab',
      position: 'relative',
    };

    // D-07 / Defect-A: ONE coherent, subtle overlay treatment. The previous
    // ring-2 + ring-offset + shadow-xl HERE stacked on top of the table
    // wrapper's own ring-2 + shadow-2xl, producing a heavy, janky-looking
    // ghost. The single soft treatment now lives on the table wrapper in
    // BacklogPage; the row itself adds nothing extra.
    const overlayClassName = isOverlay ? 'bg-background' : undefined;

    // D-07 ghost placeholder: when this row is the dragged item (live-reordered
    // into its drop slot), render it as a translucent, dashed-outlined, muted
    // row so it reads as "the issue lands here". Suppressed for the DragOverlay
    // clone, which stays solid.
    const ghostPlaceholderClass =
      isDragging && !isOverlay
        ? 'opacity-50 border border-dashed border-primary/50 bg-muted/40'
        : undefined;

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

    const rowClassName = cn(
      'border-b border-border transition-colors cursor-pointer',
      isFlagged
        ? 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40'
        : 'hover:bg-muted/30',
      isFocused && 'bg-muted border-l-2 border-primary',
      ghostPlaceholderClass,
      overlayClassName,
    );

    const cellsProps = {
      issue,
      epicKey,
      epicName,
      epicColorResult,
      storyPoints,
      onIssueClick,
      epicsLoading,
      isFlagged,
    };

    if (!onMoveToSprint && !onMoveToBacklog && !onToggleFlag) {
      return (
        <tr
          ref={setNodeRef}
          data-testid={`backlog-row-${issue.key}`}
          className={rowClassName}
          style={dragStyle}
          data-dragging={isDragging ? 'true' : undefined}
          onClick={() => {
            if (justDragged?.current) return;
            (onOpenIssue ?? onIssueClick)(issue.key);
          }}
          aria-current={isFocused ? 'true' : undefined}
          {...attributes}
          {...listeners}
        >
          <RowCells {...cellsProps} />
        </tr>
      );
    }

    return (
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <tr
              ref={setNodeRef}
              data-testid={`backlog-row-${issue.key}`}
              className={rowClassName}
              style={dragStyle}
              data-dragging={isDragging ? 'true' : undefined}
              onClick={() => {
                if (justDragged?.current) return;
                (onOpenIssue ?? onIssueClick)(issue.key);
              }}
              aria-current={isFocused ? 'true' : undefined}
              {...attributes}
              {...listeners}
            >
              <RowCells {...cellsProps} />
            </tr>
          }
        />
        <ContextMenuContent>
          {(onMoveToSprint || onMoveToBacklog) && (
            <ContextMenuGroup>
              <ContextMenuLabel>Move to...</ContextMenuLabel>
              <ContextMenuSeparator />
              <SprintMoveMenuItems
                sprints={sprints ?? []}
                currentSprintId={(issue.fields.sprint as { id: number } | null)?.id ?? null}
                showBacklog={!!onMoveToBacklog}
                onSelectSprint={(sprintId, sprintName) =>
                  onMoveToSprint?.(issue.key, sprintId, sprintName)
                }
                onSelectBacklog={() => onMoveToBacklog?.(issue.key)}
                Item={ContextMenuItem}
                Separator={ContextMenuSeparator}
                Label={ContextMenuLabel}
              />
            </ContextMenuGroup>
          )}
          {onToggleFlag && (
            <>
              {(onMoveToSprint || onMoveToBacklog) && <ContextMenuSeparator />}
              <ContextMenuGroup>
                <ContextMenuLabel>Flag</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onToggleFlag(issue.key)}>
                  <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300" />
                  {isFlagged ? 'Unflag' : 'Flag'}
                </ContextMenuItem>
              </ContextMenuGroup>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  },
);

export default BacklogRow;
