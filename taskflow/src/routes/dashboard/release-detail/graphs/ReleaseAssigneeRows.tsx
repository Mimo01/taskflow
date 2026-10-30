import { Users } from 'lucide-react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { releaseTooltipRows } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import { SegmentedBar } from '../../releases-list/ReleaseAgendaParts';
import type { ReleaseAssigneeRow } from '../releaseBuckets';
import { ASSIGNEE_ROW_HEIGHT, ASSIGNEE_SKELETON_ROWS, GraphSlot } from './GraphSlot';

const COMPACT_ROW_HEIGHT = 24;
const COMPACT_MAX_ROWS = 5;
const ROW_GRID =
  'grid grid-cols-[22px_minmax(70px,1fr)_minmax(60px,1.2fr)_40px] items-center gap-2';
const ROW_GRID_COMPACT =
  'grid grid-cols-[20px_minmax(96px,1.6fr)_minmax(36px,1fr)_30px] items-center gap-2';

/** By assignee: one avatar row per person with a slim status bar. Counts issues; SP only in the tooltip. */
export function ReleaseAssigneeRows({
  rows,
  state,
  showStoryPoints,
  compact = false,
  className,
}: {
  rows: ReleaseAssigneeRow[];
  state: 'loading' | 'error' | 'empty' | 'ready';
  showStoryPoints: boolean;
  /** Band mode: 24px rows, at most COMPACT_MAX_ROWS, the rest summarised as "+K more". */
  compact?: boolean;
  className?: string;
}) {
  const rowHeight = compact ? COMPACT_ROW_HEIGHT : ASSIGNEE_ROW_HEIGHT;
  const shown = compact ? rows.slice(0, COMPACT_MAX_ROWS) : rows;
  const hidden = rows.slice(shown.length);
  return (
    <GraphSlot
      title="By assignee"
      icon={Users}
      state={state}
      height={ASSIGNEE_ROW_HEIGHT * ASSIGNEE_SKELETON_ROWS}
      emptyLabel="No issues"
      testId="release-graph-assignees"
      className={className}
      skeleton={
        <div className="flex flex-col">
          {Array.from({ length: ASSIGNEE_SKELETON_ROWS }, (_, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
              key={i}
              data-testid="assignee-skeleton-row"
              className="w-full"
              style={{ height: ASSIGNEE_ROW_HEIGHT - 6, marginBlock: 3 }}
            />
          ))}
        </div>
      }
    >
      <div className="flex flex-col">
        {shown.map((row) => (
          <Tooltip key={row.id}>
            <TooltipTrigger
              delay={0}
              render={<div />}
              data-testid={`assignee-row-${row.id}`}
              className={cn(
                compact ? ROW_GRID_COMPACT : ROW_GRID,
                'relative z-10 rounded px-1 hover:bg-muted/50',
              )}
              style={{ height: rowHeight }}
            >
              {row.unassigned ? (
                <span className="size-[22px] rounded-full border border-dashed border-muted-foreground/50" />
              ) : (
                <CachedAvatar url={row.avatarUrl} name={row.name} size={compact ? 20 : 22} />
              )}
              <span
                className={cn(
                  'truncate text-xs',
                  row.unassigned && 'pr-0.5 italic text-muted-foreground',
                )}
              >
                {row.name}
              </span>
              <SegmentedBar breakdown={row.breakdown} className="h-1.5 w-full" />
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {row.done}/{row.total}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody title={row.name}>
                {releaseTooltipRows(row.breakdown).map((r) => (
                  <TooltipRow key={r.label} color={r.color} label={r.label} value={r.value} />
                ))}
                {showStoryPoints ? <TooltipRow label="Story points" value={row.sp} /> : null}
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        ))}
        {hidden.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              delay={0}
              render={<div />}
              data-testid="assignee-more"
              className="relative z-10 px-1 text-xs text-muted-foreground"
            >
              +{hidden.length} more
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody title={`${hidden.length} more`}>
                {hidden.slice(0, 3).map((r) => (
                  <TooltipRow key={r.id} label={r.name} value={`${r.done}/${r.total}`} />
                ))}
                {hidden.length > 3 ? (
                  <TooltipRow label={`+${hidden.length - 3} more`} value="" />
                ) : null}
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </GraphSlot>
  );
}
