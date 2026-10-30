import { ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { RELEASE_SEGMENT_CLASS } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import { fitStatusRows, type ReleaseStatusRow, statusBarWidth } from '../releaseBuckets';
import { ASSIGNEE_ROW_HEIGHT, GraphSlot, NEW_TONE_CLASS } from './GraphSlot';

const MAX_ROWS = 6;
// Same row rhythm and column split as By assignee, so the two read as one family.
const ROW_HEIGHT = ASSIGNEE_ROW_HEIGHT;
const ROW_GRID = 'grid grid-cols-[minmax(92px,1fr)_minmax(60px,1.2fr)_40px] items-center gap-2';

/**
 * By status: issues per exact Jira status name, bar colour = status category
 * only. Takes the MR donut's slot when there is no GitLab milestone (or it has
 * no MRs), so the slot always carries information.
 */
export function ReleaseStatusRows({
  rows,
  state,
  compact = false,
  className,
}: {
  rows: ReleaseStatusRow[];
  state: 'loading' | 'error' | 'empty' | 'ready';
  /** Band mode: 24px rows and at most 5 of them. */
  compact?: boolean;
  className?: string;
}) {
  const rowHeight = compact ? 24 : ROW_HEIGHT;
  // WR-08: on overflow, done statuses collapse first so open work stays visible.
  const { shown, hidden } = fitStatusRows(rows, compact ? 5 : MAX_ROWS);
  const total = rows.reduce((n, r) => n + r.count, 0);
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
      <div className="flex max-w-[640px] flex-col">
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
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    row.cat === 'new' ? NEW_TONE_CLASS : RELEASE_SEGMENT_CLASS[row.cat],
                  )}
                  style={{ width: `${statusBarWidth(row.count, total)}%` }}
                />
              </div>
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {row.count}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody title={row.name}>
                <TooltipRow label="Issues" value={row.count} />
                <TooltipRow label="Share" value={`${Math.round((row.count / total) * 100)}%`} />
                {row.mergedStatuses ? (
                  <TooltipRow label="Done statuses" value={row.mergedStatuses} />
                ) : null}
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        ))}
        {hidden.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              delay={0}
              render={<div />}
              data-testid="status-more"
              className="relative z-10 px-1 pt-1 text-xs text-muted-foreground"
            >
              +{hidden.length} more statuses
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody title={`${hidden.length} more`}>
                {hidden.slice(0, 3).map((r) => (
                  <TooltipRow key={`${r.cat}:${r.name}`} label={r.name} value={r.count} />
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
