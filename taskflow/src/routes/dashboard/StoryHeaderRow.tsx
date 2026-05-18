/**
 * StoryHeaderRow — Collapsible story swimlane header.
 *
 * Spans the full board width. Shows: chevron toggle, story key, summary,
 * epic pill (when epic data is present), status badge, assignee avatar,
 * and subtask count. Clicking the row opens the detail sheet; clicking
 * the chevron toggles expand/collapse without opening the sheet.
 */
import { ChevronRight } from 'lucide-react';
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
  transitions,
  onTransition,
  transitionError,
  assigneeAvatarUrl,
  assigneeDisplayName,
  epicKey,
  epicName,
  epicColorResult,
  onEpicClick,
}: StoryHeaderRowProps) {
  const rowContent = (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 transition-colors border-b',
        isExpanded
          ? 'bg-muted/40 hover:bg-muted/60 border-border/60'
          : 'bg-muted/40 hover:bg-muted/60 border-border/60 mb-px',
      )}
    >
      {/* Chevron — toggles collapse without opening detail sheet */}
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={isExpanded ? 'Collapse story' : 'Expand story'}
      >
        <ChevronRight
          className={cn('size-4 transition-transform duration-200', isExpanded && 'rotate-90')}
        />
      </button>

      {/* Key + summary — opens detail sheet */}
      <button
        type="button"
        className="group flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
        onClick={() => onOpenDetail(storyKey)}
      >
        <span
          className={cn(
            'font-mono text-xs text-muted-foreground shrink-0',
            statusCategoryKey === 'done'
              ? 'line-through group-hover:[text-decoration-line:underline_line-through]'
              : 'group-hover:underline',
          )}
        >
          {storyKey}
        </span>
        <span className="text-sm font-medium truncate">{summary}</span>
      </button>

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
    </div>
  );

  if (!onTransition) {
    return rowContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{rowContent}</ContextMenuTrigger>
      <ContextMenuContent>
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
      </ContextMenuContent>
    </ContextMenu>
  );
}
