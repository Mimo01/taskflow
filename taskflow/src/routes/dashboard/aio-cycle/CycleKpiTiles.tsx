import { Bug, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';
import type { AioTestRun } from '@/services/aio';
import { STAT_CONTAINER_CLASS } from '../issue-detail/EpicStatCard';
import { TITLE_CLASS, Tile, TileSkeleton, VALUE_CLASS } from './AioTile';
import { CycleDefectDonuts } from './DefectSummary';
import { ExecutionDonut } from './ExecutionDonut';
import type { AioStatusCounts } from './useAioCycleData';
import type { ResolvedDefect } from './useCycleDefects';

const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/**
 * Cycle statistics: a 2x2 tile grid beside the Execution Distribution donut (stacks below
 * when the container is narrow). Every figure appears once: the donut carries the
 * per-status counts and executed/total, the header carries the last run date, so the
 * tiles show only what those cannot (pass rate of executed, re-runs, unlinked failures,
 * open defects).
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
    <div className={cn(STAT_CONTAINER_CLASS, 'flex-none border-b border-border px-6 pt-1 pb-3')}>
      <div className="flex flex-col gap-6 @3xl/epic:flex-row">
        <Section title="Cycle Statistics" className="min-w-0 flex-1 @3xl/epic:pr-6">
          <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-4">
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
                sub={<span className="truncate">{`(${pctOf(reRuns, total)}%)`}</span>}
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
        <Section title="Execution Distribution" divided>
          <ExecutionDonut counts={counts} total={total} loading={countsLoading} />
        </Section>
        {defectsLoading ? null : (
          <Section title="Defect Summary" divided>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <CycleDefectDonuts defects={defects} />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/** Headed block of the stats row; `divided` adds the vertical rule between blocks when wide. */
function Section({
  title,
  divided,
  className,
  children,
}: {
  title: string;
  divided?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'grid flex-none content-start gap-3',
        divided && '@3xl/epic:border-l @3xl/epic:border-border @3xl/epic:pl-6 @3xl/epic:pr-2',
        className,
      )}
    >
      <h3 className={TITLE_CLASS}>{title}</h3>
      {children}
    </section>
  );
}
