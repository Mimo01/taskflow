import { Circle, CircleCheck, CircleDashed, ListChecks, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { RELEASE_SEGMENT_CLASS } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import {
  type ReleaseStatusCategoryRow,
  type ReleaseStatusRow,
  statusCategoryRows,
  WAFFLE_LAYOUT_COMPACT,
} from '../releaseBuckets';
import { GraphSlot, type GraphSlotState, NEW_TONE_CLASS } from './GraphSlot';
import { ROW_TOOLTIP_SIDE, rowToggleProps } from './rowToggle';

// Same row geometry as the compact By type waffle (stacked directly under it):
// name column, column gap, 12px line, px-1.5 py-1 selection padding.
const { block: LINE, nameCol: NAME_COL, rowGap: COL_GAP } = WAFFLE_LAYOUT_COMPACT;
const ROW_HEIGHT = LINE + 8;
const ICON: Record<ReleaseStatusCategoryRow['cat'], LucideIcon> = {
  new: Circle,
  indeterminate: CircleDashed,
  done: CircleCheck,
};

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
              style={{ height: ROW_HEIGHT - 4, marginBlock: 2 }}
            />
          ))}
        </div>
      }
    >
      <div className="flex min-w-0 flex-col">
        {cats.map((row) => {
          const toggle = rowToggleProps(row.filterValues, activeValues, onToggle);
          const Icon = ICON[row.cat];
          const cells = (
            <>
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs">{row.label}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
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
              <span className="text-right text-xs leading-none tabular-nums text-muted-foreground">
                {row.count}
              </span>
            </>
          );
          const rowProps = {
            'data-testid': `status-row-${row.cat}`,
            style: {
              height: ROW_HEIGHT,
              columnGap: COL_GAP,
              gridTemplateColumns: `${NAME_COL}px minmax(40px,1fr) 2rem`,
            },
          };
          const rowClass = 'relative z-10 grid max-w-[22rem] items-center rounded px-1.5';
          if (row.count === 0) {
            return (
              <div key={row.cat} className={rowClass} {...rowProps}>
                {cells}
              </div>
            );
          }
          return (
            <Tooltip key={row.cat}>
              <TooltipTrigger
                delay={0}
                render={toggle.render}
                className={cn(rowClass, 'hover:bg-muted/50', toggle.className)}
                {...rowProps}
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
