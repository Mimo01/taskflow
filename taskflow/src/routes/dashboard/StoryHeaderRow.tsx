/**
 * StoryHeaderRow — Collapsible story swimlane header.
 *
 * Spans the full board width. Shows: chevron toggle, story key, summary,
 * status badge, and subtask count. Clicking the row opens the detail sheet;
 * clicking the chevron toggles expand/collapse without opening the sheet.
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';

interface StoryHeaderRowProps {
  storyKey: string;
  summary: string;
  statusName: string;
  statusCategoryKey: string;
  subtaskCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenDetail: (key: string) => void;
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
}: StoryHeaderRowProps) {
  const statusStyle = statusCategoryBadgeClass(statusCategoryKey);

  return (
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
      <span className={cn('shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium', statusStyle)}>
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
}
