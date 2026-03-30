/**
 * TaskCard — Compact Jira issue card for the Sprint Board view.
 *
 * Shows issue key, summary (2-line clamp), assignee avatar (or initials),
 * and a health dot slot (gray if undefined, colored if Plan 03 provides health).
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
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue, JiraTransition } from '@/services/jira';
import type { ReviewHealth } from '@/services/linkEngine';

const HEALTH_COLORS: Record<ReviewHealth, string> = {
  approved: 'bg-green-500',
  changes_requested: 'bg-red-500',
  waiting_for_review: 'bg-amber-400',
};

interface TaskCardProps {
  issue: JiraIssue;
  healthDot?: ReviewHealth;
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
}

export default function TaskCard({
  issue,
  healthDot,
  subtaskCount,
  isExpanded,
  onToggle,
  isSubtask,
  showStatus,
  onClick,
  transitions,
  onTransition,
  transitionError,
}: TaskCardProps) {
  const assignee = issue.fields.assignee;
  const avatarUrl = assignee?.avatarUrls['48x48'];
  const displayName = assignee?.displayName ?? '';

  const dotColor = healthDot ? HEALTH_COLORS[healthDot] : 'bg-muted-foreground/40';

  const cardContent = (
    <>
      <div
        className={cn(
          'border rounded-lg px-2 py-2 density-compact:py-1 density-comfortable:py-3 bg-card w-full flex flex-col gap-1 cursor-pointer hover:border-primary/50 transition-colors',
          isSubtask && 'border-l-2 border-l-muted',
        )}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick?.();
        }}
      >
        {/* Issue key */}
        <div className="text-xs font-mono text-muted-foreground">{issue.key}</div>

        {/* Summary — max 2 lines */}
        <div
          className="text-sm overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {issue.fields.summary}
        </div>

        {/* Status badge -- shown when not in a column context */}
        {showStatus && (
          <span
            className={cn(
              'self-start rounded px-1.5 py-0.5 text-xs font-medium',
              statusCategoryBadgeClass(issue.fields.status.statusCategory?.key),
            )}
          >
            {issue.fields.status.name}
          </span>
        )}

        {/* Bottom row: assignee avatar + health dot */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center">
            {assignee && (
              <CachedAvatar url={avatarUrl} name={displayName} size={20} />
            )}
          </div>

          {/* Health dot */}
          <span className={cn('inline-block size-1.5 rounded-full', dotColor)} />
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
      {transitionError && (
        <p className="text-xs text-destructive px-1">{transitionError}</p>
      )}
    </>
  );

  // Only wrap in ContextMenu when onTransition is provided (sprint board context)
  if (!onTransition) {
    return cardContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{cardContent}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Move to...</ContextMenuLabel>
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
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  statusCategoryBadgeClass(transition.to.statusCategory?.key),
                )}
              >
                {transition.name}
              </span>
            </ContextMenuItem>
          ))
        ) : (
          <ContextMenuLabel className="text-muted-foreground italic">
            No transitions available
          </ContextMenuLabel>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
