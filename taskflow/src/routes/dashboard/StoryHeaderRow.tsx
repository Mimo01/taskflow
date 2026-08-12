/**
 * StoryHeaderRow — Collapsible story swimlane header.
 *
 * Spans the full board width. Shows: chevron toggle, story key, summary,
 * epic pill (when epic data is present), status badge, assignee avatar,
 * and subtask count. Clicking the chevron toggles expand/collapse without
 * opening anything.
 *
 * PEEK-01/PEEK-05: when onOpenIssue is provided, the row body becomes a
 * div[role=button] that opens the issue peek panel on click; the issue key
 * renders as an inner <button> that navigates to the full /issue/KEY page
 * (stopPropagation prevents the body peek from also firing). When onOpenIssue
 * is omitted, behavior degrades to today's: the key navigates full-page and
 * the row body has no peek handler.
 */
import { ChevronRight, Flag } from 'lucide-react';
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
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import type { EpicColorResult } from '@/lib/epicColors';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraTransition } from '@/services/jira';

interface StoryHeaderRowProps {
  storyKey: string;
  summary: string;
  statusName: string;
  statusCategoryKey: string;
  subtaskCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenDetail: (key: string) => void;
  /** Story's own Jira priority — rendered as a PriorityIcon in the header. */
  priority?: { name?: string | null; iconUrl?: string | null } | null;
  /** Story's issue-type name — rendered as an IssueTypeIcon before the key. */
  issueTypeName?: string;
  /**
   * PEEK-01: clicking the row body opens the issue peek panel. When provided,
   * the outer row becomes a div[role=button] so the inner key <button> is valid
   * HTML (no nested buttons — D-10 / Pitfall 1).
   */
  onOpenIssue?: (key: string) => void;
  transitions?: JiraTransition[];
  onTransition?: (
    transitionId: string,
    toStatusName: string,
    toStatusId: string,
    toStatusCategoryKey?: string,
  ) => void;
  transitionError?: string | null;
  assigneeAvatarUrl?: string | null;
  assigneeDisplayName?: string;
  epicKey?: string | null;
  epicName?: string | null;
  epicColorResult?: EpicColorResult | null;
  onEpicClick?: (key: string) => void;
  /** Whether this story is currently flagged as an impediment */
  isFlagged?: boolean;
  /** Called when user selects Flag/Unflag from the context menu */
  onToggleFlag?: () => void;
}

export function StoryHeaderRow({
  storyKey,
  summary,
  statusName,
  statusCategoryKey,
  subtaskCount,
  isExpanded,
  onToggle,
  onOpenDetail,
  priority,
  issueTypeName,
  onOpenIssue,
  transitions,
  onTransition,
  transitionError,
  assigneeAvatarUrl,
  assigneeDisplayName,
  epicKey,
  epicName,
  epicColorResult,
  onEpicClick,
  isFlagged,
  onToggleFlag,
}: StoryHeaderRowProps) {
  // PEEK-01/PEEK-05 (D-10 / Pitfall 1): when onOpenIssue is wired, the outer row
  // becomes div[role=button] (body → peek) so the inner key <button> is valid HTML.
  const useKeyBodySplit = !!onOpenIssue;

  const rowClassName = cn(
    'flex items-center gap-2 px-3 py-2 density-compact:py-1 density-comfortable:py-3 transition-colors border-b',
    useKeyBodySplit && 'cursor-pointer',
    isExpanded
      ? isFlagged
        ? 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40 border-border/60'
        : 'bg-muted/40 hover:bg-muted/60 border-border/60'
      : isFlagged
        ? 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40 border-border/60 mb-px'
        : 'bg-muted/40 hover:bg-muted/60 border-border/60 mb-px',
  );

  const rowInner = (
    <>
      {/* Chevron — toggles collapse without opening peek/detail */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={isExpanded ? 'Collapse story' : 'Expand story'}
      >
        <ChevronRight
          className={cn('size-4 transition-transform duration-200', isExpanded && 'rotate-90')}
        />
      </button>

      {/* Key + summary — key navigates full-page (PEEK-05); summary bubbles to body → peek */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isFlagged && <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />}
        {issueTypeName && <IssueTypeIcon typeName={issueTypeName} />}
        <button
          type="button"
          className={cn(
            'group font-mono text-xs text-muted-foreground shrink-0 cursor-pointer',
            statusCategoryKey === 'done'
              ? 'line-through group-hover:[text-decoration-line:underline_line-through]'
              : 'group-hover:underline',
          )}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(storyKey);
          }}
        >
          {storyKey}
        </button>
        {/* Story priority icon — PriorityIcon guards null/missing priority */}
        <PriorityIcon priority={priority} />
        <span className="text-sm font-medium truncate">{summary}</span>
      </div>

      {/* Assignee avatar + name — only rendered when story has an assignee */}
      {assigneeDisplayName && (
        <div className="shrink-0 flex items-center gap-1.5">
          <CachedAvatar url={assigneeAvatarUrl} name={assigneeDisplayName} size={20} />
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {assigneeDisplayName}
          </span>
        </div>
      )}

      {/* Epic pill — only rendered when story has an epic link */}
      {epicKey && epicName && epicColorResult && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEpicClick?.(epicKey);
          }}
          className={cn(
            'shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity',
            epicColorResult.className,
          )}
          style={epicColorResult.style}
          title={`${epicKey}: ${epicName}`}
        >
          {epicName}
        </button>
      )}

      {/* Status badge */}
      <span className={statusPillClass(statusCategoryKey)}>{statusName}</span>

      {/* Subtask count */}
      <span className="shrink-0 min-w-[5rem] text-xs text-muted-foreground">
        {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
      </span>

      {transitionError && (
        <span className="shrink-0 text-xs text-destructive">{transitionError}</span>
      )}
    </>
  );

  const rowContent = useKeyBodySplit ? (
    // biome-ignore lint/a11y/useSemanticElements: div[role=button] required — inner key/chevron/epic are <button>, nested button is invalid HTML (D-10 / Pitfall 1)
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenIssue?.(storyKey)}
      onKeyDown={(e) => {
        // Only act on the row itself — Enter/Space on an inner <button> (key,
        // chevron, epic) synthesizes a click there but the keydown still bubbles
        // here; without this guard it would ALSO fire the body peek.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenIssue?.(storyKey);
        }
      }}
      className={rowClassName}
    >
      {rowInner}
    </div>
  ) : (
    <div className={rowClassName}>{rowInner}</div>
  );

  if (!onTransition && !onToggleFlag) {
    return rowContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{rowContent}</ContextMenuTrigger>
      <ContextMenuContent>
        {onTransition && (
          <>
            <ContextMenuGroup>
              <ContextMenuLabel>Move to...</ContextMenuLabel>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            {transitions && transitions.length > 0 ? (
              transitions.map((transition) => (
                <ContextMenuItem
                  key={transition.id}
                  onClick={() =>
                    onTransition(
                      transition.id,
                      transition.to.name,
                      transition.to.id,
                      transition.to.statusCategory?.key,
                    )
                  }
                >
                  <span className="text-muted-foreground">→</span>
                  <span className={statusPillClass(transition.to.statusCategory?.key)}>
                    {transition.name}
                  </span>
                </ContextMenuItem>
              ))
            ) : (
              <ContextMenuGroup>
                <ContextMenuLabel className="text-muted-foreground italic">
                  No transitions available
                </ContextMenuLabel>
              </ContextMenuGroup>
            )}
          </>
        )}
        {onToggleFlag && (
          <>
            {onTransition && <ContextMenuSeparator />}
            <ContextMenuGroup>
              <ContextMenuLabel>Flag</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={onToggleFlag}>
                <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300" />
                {isFlagged ? 'Unflag' : 'Flag'}
              </ContextMenuItem>
            </ContextMenuGroup>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
