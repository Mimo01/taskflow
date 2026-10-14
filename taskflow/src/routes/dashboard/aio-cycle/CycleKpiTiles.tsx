import { Bug, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';
import type { AioTestRun } from '@/services/aio';
import { STAT_CONTAINER_CLASS } from '../issue-detail/EpicStatCard';
import { Tile, TileSkeleton, VALUE_CLASS } from './AioTile';
import { CycleDefectDonuts } from './DefectSummary';
import { ExecutionDonut } from './ExecutionDonut';
import type { AioStatusCounts } from './useAioCycleData';
import type { ResolvedDefect } from './useCycleDefects';

const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** Detail-page section heading (same as Progress / Activity / run sections). */
const HEADING_CLASS = 'text-sm font-medium leading-5 text-muted-foreground';

/**
 * Cycle stats block: Cycle Statistics tiles | Execution Distribution donut | Defect Summary
 * donuts. Every figure appears once: the donut carries the per-status split (the Executions
 * tab chips carry the counts), the header carries the last run date, so the tiles show only
 * what those cannot (pass rate of executed, re-runs, unlinked failures, open defects).
 *
 * Three layouts on the block's own container width:
 *  - narrow: everything stacked, tiles 2x2;
 *  - >= 768px (@3xl): tiles 4-across, then Execution | Defect Summary on one row;
 *  - >= 1280px (@7xl): tiles 2x2 | Execution | Defect Summary on one row.
 */
export function CycleKpiTiles({
  counts,
  total,
  runs,
  countsLoading,
  openDefects,
  totalDefects,
  defectsLoading,
  defects,
}: {
  counts: AioStatusCounts;
  total: number;
  runs: AioTestRun[] | undefined;
  countsLoading: boolean;
  openDefects: number;
  totalDefects: number;
  defectsLoading: boolean;
  defects: ResolvedDefect[];
}) {
  const executed = counts.pass + counts.fail + counts.blocked;
  const passPct = pctOf(counts.pass, executed);
  const reRunList = (runs ?? []).filter((r) => (r.runCount ?? 0) > 1);
  const reRuns = reRunList.length;
  const maxRuns = reRunList.reduce((m, r) => Math.max(m, r.runCount ?? 0), 0);
  const unlinked = (runs ?? []).filter(
    (r) => (r.status === 'FAIL' || r.status === 'BLOCKED') && (r.jiraDefectIDs?.length ?? 0) === 0,
  );
  const failedNoDefect = unlinked.filter((r) => r.status === 'FAIL').length;
  const blockedNoDefect = unlinked.filter((r) => r.status === 'BLOCKED').length;
  const failing = counts.fail + counts.blocked;

  return (
    <div className={cn(STAT_CONTAINER_CLASS, 'flex-none border-b border-border px-6 py-4')}>
      <div className="flex flex-col gap-6 @7xl/epic:flex-row">
        <Section title="Cycle Statistics" className="min-w-0 flex-1">
          <div className="grid w-full min-w-0 grid-cols-2 gap-x-6 gap-y-4 @3xl/epic:grid-cols-4 @7xl/epic:grid-cols-2">
            {countsLoading ? (
              <TileSkeleton testId="kpi-skeleton-pass" icon={CheckCircle2} tint="green" />
            ) : (
              <Tile
                testId="kpi-pass-rate"
                icon={CheckCircle2}
                tint="green"
                label="Pass rate"
                value={<span className={VALUE_CLASS}>{executed > 0 ? `${passPct}%` : '—'}</span>}
                sub={<span className="truncate">of executed</span>}
                tip={
                  <TooltipBody title="Pass rate">
                    <TooltipRow label="Passed" value={counts.pass} color="var(--color-green-500)" />
                    <TooltipRow label="Failed" value={counts.fail} color="var(--color-red-500)" />
                    <TooltipRow
                      label="Blocked"
                      value={counts.blocked}
                      color="var(--color-orange-400)"
                    />
                  </TooltipBody>
                }
              />
            )}
            {!runs ? (
              <TileSkeleton testId="kpi-skeleton-reruns" icon={RotateCcw} tint="blue" />
            ) : (
              <Tile
                testId="kpi-reruns"
                icon={RotateCcw}
                tint="blue"
                label="Re-runs"
                value={<span className={VALUE_CLASS}>{reRuns}</span>}
                sub={<span className="truncate">{`${pctOf(reRuns, total)}% of cases`}</span>}
                tip={
                  <TooltipBody title="Re-runs">
                    <TooltipRow label="Re-run cases" value={reRuns} />
                    <TooltipRow label="Max runs" value={maxRuns} />
                  </TooltipBody>
                }
              />
            )}
            {!runs ? (
              <TileSkeleton testId="kpi-skeleton-unlinked" icon={XCircle} tint="red" />
            ) : (
              <Tile
                testId="kpi-unlinked"
                icon={XCircle}
                tint="red"
                label="Unlinked failures"
                value={
                  <span
                    className={cn(
                      VALUE_CLASS,
                      unlinked.length > 0 && 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {unlinked.length}
                  </span>
                }
                sub={<span className="truncate">{`of ${failing} failing`}</span>}
                tip={
                  <TooltipBody title="Unlinked failures">
                    <TooltipRow
                      label="Failed w/o defect"
                      value={failedNoDefect}
                      color="var(--color-red-500)"
                    />
                    <TooltipRow
                      label="Blocked w/o defect"
                      value={blockedNoDefect}
                      color="var(--color-orange-400)"
                    />
                  </TooltipBody>
                }
              />
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
                sub={<span className="truncate">{`of ${totalDefects} linked`}</span>}
                tip={
                  <TooltipBody title="Open defects">
                    <TooltipRow label="Open" value={openDefects} />
                    <TooltipRow label="Done" value={Math.max(0, totalDefects - openDefects)} />
                  </TooltipBody>
                }
              />
            )}
          </div>
        </Section>

        {/* Charts: a hairline below the tiles, a vertical rule beside them when everything fits
            in one row. Rules always get 24px on both sides. */}
        <div className="flex flex-col gap-6 border-t border-border pt-6 @3xl/epic:flex-row @7xl/epic:border-t-0 @7xl/epic:border-l @7xl/epic:pt-0 @7xl/epic:pl-6">
          <Section title="Execution Distribution" className="flex-none">
            <ExecutionDonut counts={counts} total={total} loading={countsLoading} />
          </Section>
          <Section
            title="Defect Summary"
            className="min-w-0 flex-1 @3xl/epic:border-l @3xl/epic:border-border @3xl/epic:pl-6"
          >
            <div className="flex w-full min-w-0 flex-wrap items-center gap-x-8 gap-y-4">
              <CycleDefectDonuts defects={defects} loading={defectsLoading} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/** Headed block: heading on the shared top line, body vertically centred in the leftover height. */
function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h3 className={HEADING_CLASS}>{title}</h3>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </section>
  );
}
