import { ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { RELEASE_SEGMENT_CLASS } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import type { ReleaseStatusRow } from '../releaseBuckets';
import { GraphSlot } from './GraphSlot';

const MAX_ROWS = 6;
const ROW_HEIGHT = 30;
const ROW_HEIGHT_FEW = 36;
const ROW_GRID = 'grid grid-cols-[minmax(80px,1.2fr)_minmax(60px,1.6fr)_32px] items-center gap-3';

/**
 * By status: issues per exact Jira status name, bar colour = status category
 * only. Takes the MR donut's slot when there is no GitLab milestone (or it has
 * no MRs), so the slot always carries information.
 */
export function ReleaseStatusRows({
  rows,
  state,
  className,
}: {
  rows: ReleaseStatusRow[];
  state: 'loading' | 'error' | 'empty' | 'ready';
  className?: string;
}) {
  const shown = rows.slice(0, MAX_ROWS);
  const more = rows.length - shown.length;
  // Few statuses get taller rows so the slot keeps pace with its neighbour.
  const rowHeight = shown.length <= 3 ? ROW_HEIGHT_FEW : ROW_HEIGHT;
  const max = rows.reduce((m, r) => Math.max(m, r.count), 1);
  return (
    <GraphSlot
      title="By status"
      icon={ListChecks}
      state={state}
      height={ROW_HEIGHT * 4}
      emptyLabel="No issues"
      testId="release-graph-status"
      className={className}
      skeleton={
        <div className="flex flex-col">
          {Array.from({ length: 4 }, (_, i) => (
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
      <div className="my-auto flex flex-col">
        {shown.map((row) => (
          <Tooltip key={`${row.cat}:${row.name}`}>
            <TooltipTrigger
              delay={0}
              render={<div />}
              data-testid={`status-row-${row.name}`}
              className={cn(ROW_GRID, 'relative z-10 rounded px-1 hover:bg-muted/50')}
              style={{ height: rowHeight }}
            >
              <span className="truncate text-xs">{row.name}</span>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    row.cat === 'new' ? 'bg-muted-foreground/30' : RELEASE_SEGMENT_CLASS[row.cat],
                  )}
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {row.count}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody title={row.name}>
                <TooltipRow label="Issues" value={row.count} />
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        ))}
        {more > 0 ? (
          <div className="px-1 pt-1 text-xs text-muted-foreground">+{more} more statuses</div>
        ) : null}
      </div>
    </GraphSlot>
  );
}
