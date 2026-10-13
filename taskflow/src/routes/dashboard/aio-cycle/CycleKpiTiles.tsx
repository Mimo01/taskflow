import { Bug, CheckCircle2, PlayCircle, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  PROGRESS_SEGMENT_CLASS,
  progressTooltipRows,
  type StatusKey,
  statusLabel,
  toDateKey,
} from '@/lib/aio-cycle-list';
import { formatDateKey } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';
import type { AioTestRun } from '@/services/aio';
import { STAT_CONTAINER_CLASS, STAT_GRID_CLASS } from '../issue-detail/EpicStatCard';
import { Tile, TileSkeleton, VALUE_CLASS } from './AioTile';
import type { AioStatusCounts } from './useAioCycleData';

const SEGMENT_ORDER: StatusKey[] = ['pass', 'fail', 'blocked', 'inProgress', 'notRun'];

const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/**
 * Four KPI tiles (Pass rate, Executed, Failing / Blocked, Open defects) on the shared
 * Card + EpicStatCard tile pieces, with the segmented progress bar underneath. The bar has
 * no legend: each segment carries its own tooltip (at most 2 rows).
 */
export function CycleKpiTiles({
  counts,
  total,
  runs,
  countsLoading,
  openDefects,
  totalDefects,
  defectsLoading,
  lastExecuted,
}: {
  counts: AioStatusCounts;
  total: number;
  runs: AioTestRun[] | undefined;
  countsLoading: boolean;
  openDefects: number;
  totalDefects: number;
  defectsLoading: boolean;
  /** ISO date of the most recent run update, or null. */
  lastExecuted: string | null;
}) {
  const executed = counts.pass + counts.fail + counts.blocked;
  const failing = counts.fail + counts.blocked;
  const passPct = pctOf(counts.pass, total);
  const reRuns = (runs ?? []).filter((r) => (r.runCount ?? 0) > 1).length;
  const withoutDefect = (runs ?? []).filter(
    (r) => (r.status === 'FAIL' || r.status === 'BLOCKED') && (r.jiraDefectIDs?.length ?? 0) === 0,
  ).length;
  const lastKey = toDateKey(lastExecuted);

  const segments = SEGMENT_ORDER.filter((k) => counts[k] > 0 && total > 0);

  return (
    <div className={cn(STAT_CONTAINER_CLASS, 'flex-none border-b border-border px-6 py-4')}>
      <div className={STAT_GRID_CLASS}>
        {countsLoading ? (
          <>
            <TileSkeleton testId="kpi-skeleton-pass" icon={CheckCircle2} tint="green" />
            <TileSkeleton testId="kpi-skeleton-executed" icon={PlayCircle} tint="blue" />
            <TileSkeleton testId="kpi-skeleton-failing" icon={XCircle} tint="red" />
          </>
        ) : (
          <>
            <Tile
              testId="kpi-pass-rate"
              icon={CheckCircle2}
              tint="green"
              label="Pass rate"
              value={<span className={VALUE_CLASS}>{total > 0 ? `${passPct}%` : '—'}</span>}
              sub={<span className="truncate">{counts.pass} passed</span>}
              tip={
                <TooltipBody title="Pass rate">
                  {progressTooltipRows(counts).map((r) => (
                    <TooltipRow key={r.label} label={r.label} value={r.value} color={r.color} />
                  ))}
                </TooltipBody>
              }
            />
            <Tile
              testId="kpi-executed"
              icon={PlayCircle}
              tint="blue"
              label="Executed"
              value={
                <span className={VALUE_CLASS}>
                  {executed}/{total}
                </span>
              }
              sub={
                <span className="truncate">
                  {lastKey
                    ? `Last run ${formatDateKey(lastKey)}`
                    : reRuns > 0
                      ? `${reRuns} re-run`
                      : 'No runs yet'}
                </span>
              }
              tip={
                <TooltipBody title="Executed">
                  <TooltipRow label="Executed" value={executed} />
                  <TooltipRow label="In progress" value={counts.inProgress} />
                  <TooltipRow label="Not run" value={counts.notRun} />
                  <TooltipRow label="Re-runs" value={reRuns} />
                </TooltipBody>
              }
            />
            <Tile
              testId="kpi-failing"
              icon={XCircle}
              tint="red"
              label="Failing / Blocked"
              value={
                <span className={cn(VALUE_CLASS, failing > 0 && 'text-red-600 dark:text-red-400')}>
                  {failing}
                </span>
              }
              sub={
                <span className="truncate">
                  {withoutDefect > 0
                    ? `${withoutDefect} without a defect`
                    : failing > 0
                      ? 'all linked to defects'
                      : 'none failing'}
                </span>
              }
              tip={
                <TooltipBody title="Failing / Blocked">
                  <TooltipRow label="Failed" value={counts.fail} color="var(--color-red-500)" />
                  <TooltipRow
                    label="Blocked"
                    value={counts.blocked}
                    color="var(--color-orange-400)"
                  />
                  <TooltipRow label="Without a defect" value={withoutDefect} />
                </TooltipBody>
              }
            />
          </>
        )}
        {defectsLoading ? (
          <TileSkeleton testId="kpi-skeleton-defects" icon={Bug} tint="amber" />
        ) : (
          <Tile
            testId="kpi-open-defects"
            icon={Bug}
            tint="amber"
            label="Open defects"
            value={<span className={VALUE_CLASS}>{openDefects}</span>}
            sub={<span className="truncate">of {totalDefects} defects</span>}
            tip={
              <TooltipBody title="Open defects">
                <TooltipRow label="Open" value={openDefects} />
                <TooltipRow label="Done" value={Math.max(0, totalDefects - openDefects)} />
                <TooltipRow label="Total" value={totalDefects} />
              </TooltipBody>
            }
          />
        )}
      </div>

      <div className="mt-4">
        {countsLoading ? (
          <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">No runs recorded</p>
        ) : (
          <div
            data-testid="cycle-progress-bar"
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            {segments.map((k) => (
              <Tooltip key={k}>
                <TooltipTrigger
                  delay={0}
                  render={<div />}
                  data-testid={`progress-seg-${k}`}
                  className={cn('h-full', PROGRESS_SEGMENT_CLASS[k])}
                  style={{ width: `${(counts[k] / total) * 100}%` }}
                />
                <TooltipContent>
                  <TooltipBody title={statusLabel(k)}>
                    <TooltipRow label="Runs" value={counts[k]} />
                    <TooltipRow label="Share" value={`${pctOf(counts[k], total)}%`} />
                  </TooltipBody>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
