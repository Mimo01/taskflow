/**
 * StoryHeaderRow — Collapsible story swimlane header.
 *
 * Spans the full board width. Shows: chevron toggle, story key, summary,
 * status badge, and subtask count. Clicking the row opens the detail sheet;
 * clicking the chevron toggles expand/collapse without opening the sheet.
 *
 * When `onTransition` is provided, right-clicking the row shows a "Move to..."
 * context menu identical to the TaskCard pattern.
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
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
  transitionError?: string;
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
}: StoryHeaderRowProps) {
  const statusStyle = statusCategoryBadgeClass(statusCategoryKey);

  const innerRow = (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border/30">
      {/* Chevron — toggles collapse without opening detail sheet */}
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={isExpanded ? 'Collapse story' : 'Expand story'}
      >
        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>

      {/* Key + summary — opens detail sheet */}
      <button
        type="button"
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
        onClick={() => onOpenDetail(storyKey)}
      >
        <span className="font-mono text-xs text-muted-foreground shrink-0">{storyKey}</span>
        <span className="text-sm font-medium truncate">{summary}</span>
      </button>

      {/* Status badge */}
      <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs font-medium', statusStyle)}>
        {statusName}
      </span>

      {/* Subtask count */}
      {subtaskCount > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );

  if (!onTransition) {
    return innerRow;
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{innerRow}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuLabel>Move to...</ContextMenuLabel>
            <ContextMenuSeparator />
            {transitions && transitions.length > 0 ? (
              transitions.map((t) => {
                const catKey = t.to.statusCategory?.key;
                const badgeClass = statusCategoryBadgeClass(catKey ?? 'new');
                return (
                  <ContextMenuItem
                    key={t.id}
                    onClick={() =>
                      onTransition(t.id, t.to.name, t.to.id, catKey)
                    }
                  >
                    <span className="mr-2">→</span>
                    <span
                      className={cn('rounded px-1.5 py-0.5 text-xs font-medium', badgeClass)}
                    >
                      {t.to.name}
                    </span>
                  </ContextMenuItem>
                );
              })
            ) : (
              <ContextMenuItem disabled>No transitions available</ContextMenuItem>
            )}
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
      {transitionError && (
        <p className="text-xs text-destructive px-3">{transitionError}</p>
      )}
    </>
  );
}
