import { ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { RELEASE_SEGMENT_CLASS } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import { type ReleaseStatusRow, statusCategoryRows } from '../releaseBuckets';
import { GraphSlot, type GraphSlotState, NEW_TONE_CLASS } from './GraphSlot';
import { ROW_TOOLTIP_SIDE, rowToggleProps } from './rowToggle';

/** Same compact rhythm as By type, so the short lists read as one family. */
const ROW_HEIGHT = 22;
const ROW_GRID = 'grid grid-cols-[minmax(64px,auto)_minmax(48px,1fr)_28px] items-center gap-2';

/**
 * By status: three rows, to do, in progress, done. Bar = the category's share of
 * all issues, colour = status category. Hover lists the exact Jira statuses;
 * click toggles the task table's Status filter for every status in the row.
 */
export function ReleaseStatusRows({
  rows,
  state,
  className,
  activeValues,
  onToggle,
}: {
  rows: ReleaseStatusRow[];
  state: GraphSlotState;
  className?: string;
  activeValues?: Set<string>;
  onToggle?: (values: string[]) => void;
}) {
  const cats = statusCategoryRows(rows);
  return (
    <GraphSlot
      title="By status"
      icon={ListChecks}
      state={state}
      height={ROW_HEIGHT * 3}
      emptyLabel="No issues"
      testId="release-graph-status"
      className={className}
      skeleton={
        <div className="flex flex-col">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
              key={i}
              className="w-full"
              style={{ height: ROW_HEIGHT - 6, marginBlock: 3 }}
            />
          ))}
        </div>
      }
    >
      <div className="flex flex-col">
        {cats.map((row) => {
          const toggle = rowToggleProps(row.filterValues, activeValues, onToggle);
          const bar = (
            <div className="h-1.5 w-full rounded-full bg-muted">
              {row.count > 0 ? (
                <div
                  className={cn(
                    'h-full rounded-full',
                    row.cat === 'new' ? NEW_TONE_CLASS : RELEASE_SEGMENT_CLASS[row.cat],
                  )}
                  style={{ width: `${Math.max(row.share, 3)}%` }}
                />
              ) : null}
            </div>
          );
          const cells = (
            <>
              <span className="truncate text-xs">{row.label}</span>
              {bar}
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {row.count}
              </span>
            </>
          );
          const rowClass = cn(ROW_GRID, 'relative z-10 rounded px-1.5', toggle.className);
          if (row.count === 0) {
            return (
              <div
                key={row.cat}
                data-testid={`status-row-${row.cat}`}
                className={rowClass}
                style={{ height: ROW_HEIGHT }}
              >
                {cells}
              </div>
            );
          }
          return (
            <Tooltip key={row.cat}>
              <TooltipTrigger
                delay={0}
                render={toggle.render}
                data-testid={`status-row-${row.cat}`}
                className={cn(rowClass, 'hover:bg-muted/50')}
                style={{ height: ROW_HEIGHT }}
                {...toggle.extra}
              >
                {cells}
              </TooltipTrigger>
              <TooltipContent side={ROW_TOOLTIP_SIDE}>
                <TooltipBody title={`${row.label} · ${row.share}%`}>
                  {row.statuses.map((s) => (
                    <TooltipRow key={s.label} label={s.label} value={s.value} />
                  ))}
                </TooltipBody>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </GraphSlot>
  );
}
