/**
 * TaskCard — Compact Jira issue card for the Sprint Board view.
 *
 * Shows issue key + type name (top row), summary (2-line clamp),
 * and a bottom row with assignee avatar (left), story points badge and
 * status badge (right). Matches Jira's familiar card layout.
 *
 * Extended props (HIER-02):
 * - subtaskCount: when > 0, renders a Badge chip and chevron toggle button
 * - isExpanded: controls chevron direction (down vs right)
 * - onToggle: called when chevron is clicked (stopPropagation included)
 * - isSubtask: adds left indent and muted left border for visual nesting
 *
 * Context menu props (r56):
 * - transitions: pre-fetched JiraTransition[] from SprintBoardTab cache
 * - onTransition: callback when a transition menu item is clicked
 * - transitionError: error message shown below the card on failed transition
 * When onTransition is not provided, no context menu is rendered (safe for non-board contexts).
 */
import { ChevronDown, ChevronRight, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue, JiraTransition } from '@/services/jira';

interface TaskCardProps {
  issue: JiraIssue;
  subtaskCount?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  isSubtask?: boolean;
  showStatus?: boolean;
  onClick?: () => void;
  /** Pre-fetched transitions for the context menu (sprint board only) */
  transitions?: JiraTransition[];
  /** Called when user selects a transition from the context menu */
  onTransition?: (
    transitionId: string,
    toStatusName: string,
    toStatusId: string,
    toStatusCategoryKey?: string,
  ) => void;
  /** Error message shown below the card after a failed transition */
  transitionError?: string;
  /** Whether this issue is currently flagged as an impediment */
  isFlagged?: boolean;
  /** Called when user selects Flag/Unflag from the context menu */
  onToggleFlag?: () => void;
}

export default function TaskCard({
  issue,
  subtaskCount,
  isExpanded,
  onToggle,
  isSubtask,
  showStatus,
  onClick,
  transitions,
  onTransition,
  transitionError,
  isFlagged,
  onToggleFlag,
}: TaskCardProps) {
  const assignee = issue.fields.assignee;
  const avatarUrl = assignee?.avatarUrls['48x48'];
  const displayName = assignee?.displayName ?? '';
  const issueTypeName = issue.fields.issuetype?.name;
  const storyPoints = issue.fields.customfield_10016 as number | null | undefined;

  const cardContent = (
    <>
      <div
        className={cn(
          'group border rounded-lg px-2 py-2 density-compact:py-1 density-comfortable:py-3 bg-card w-full flex flex-col gap-1 cursor-pointer hover:bg-accent/50 transition-colors',
          isSubtask && 'border-l-2 border-l-muted',
          isFlagged && 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40',
        )}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick?.();
        }}
      >
        {/* Top row: flag icon (when flagged) + issue key (left) + issue type name (right) */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            {isFlagged && (
              <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />
            )}
            <span
              className={cn(
                'text-xs font-mono text-muted-foreground',
                issue.fields.status.statusCategory?.key === 'done'
                  ? 'line-through group-hover:[text-decoration-line:underline_line-through]'
                  : 'group-hover:underline',
              )}
            >
              {issue.key}
            </span>
          </span>
          {issueTypeName && (
            <span className="text-[11px] text-muted-foreground/60 truncate max-w-[50%] text-right">
              {issueTypeName}
            </span>
          )}
        </div>

        {/* Summary — max 2 lines */}
        <div
          className="text-sm leading-snug overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {issue.fields.summary}
        </div>

        {/* Bottom row: assignee avatar + name (left) + story points + status badge (right) */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {assignee && (
              <>
                <CachedAvatar url={avatarUrl} name={displayName} size={20} />
                <span className="text-[11px] text-muted-foreground/80 truncate">{displayName}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Story points badge */}
            {storyPoints != null && storyPoints > 0 && (
              <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono leading-none">
                {storyPoints}
              </span>
            )}

            {/* Status badge — shown when not in a column context */}
            {showStatus && (
              <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
                {issue.fields.status.name}
              </span>
            )}
          </div>
        </div>

        {/* Subtask count chip + chevron — only when subtaskCount > 0 */}
        {subtaskCount != null && subtaskCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className="flex items-center gap-1 p-1 -mx-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
          >
            <Badge variant="secondary" className="text-xs py-0 pointer-events-none">
              {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
            </Badge>
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}
      </div>

      {/* Transition error — shown below card on failed transitions */}
      {transitionError && <p className="text-xs text-destructive px-1">{transitionError}</p>}
    </>
  );

  // Wrap in ContextMenu when onTransition or onToggleFlag is provided
  if (!onTransition && !onToggleFlag) {
    return cardContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{cardContent}</ContextMenuTrigger>
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
            <ContextMenuItem onClick={onToggleFlag}>
              <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300" />
              {isFlagged ? 'Unflag' : 'Flag'}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
