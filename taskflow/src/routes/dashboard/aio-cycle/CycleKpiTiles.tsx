import { CircleCheck, Footprints, Layers, ListChecks } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { cycleBurndownSeries } from '@/lib/aio-cycle-charts';
import type { WorkCalendar } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';
import type { AioCycle, AioTestRun } from '@/services/aio';
import { STAT_CONTAINER_CLASS } from '../issue-detail/EpicStatCard';
import { Tile, TileSkeleton, VALUE_CLASS } from './AioTile';
import { CycleBurndown } from './CycleBurndown';
import { CycleDefectDonuts } from './DefectSummary';
import { ExecutionDonut } from './ExecutionDonut';
import type { AioStatusCounts } from './useAioCycleData';
import type { ResolvedDefect } from './useCycleDefects';
import type { CycleStepStats } from './useCycleStepStats';

const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** Detail-page section heading (same as Progress / Activity / run sections). */
const HEADING_CLASS = 'text-sm font-medium leading-5 text-muted-foreground';

/**
 * Cycle stats block: Cycle Statistics tiles | Execution Distribution donut | Defect Summary
 * donuts. Every figure appears once: the donut carries the per-status split (the Executions
 * tab chips carry the counts), the header carries the last run date, so the tiles show the case
 * pass rate plus step-level metrics (step pass rate, steps executed, steps per case) that the
 * donuts cannot. Step tiles load after the case data from a throttled per-run fetch and never
 * block the Pass rate tile or the charts.
 *
 * A Burndown column (remaining cases over time against a working-day ideal) is part of the
 * block; before the first execution (or with no cases) it shows a compact empty state in the same space. The plot is absolutely positioned inside
 * its section, so it never adds height: the sibling columns set the row height and it fills it.
 *
 * Two layouts on the block's own container width (content box, so the page is 56px wider):
 *  - < 896px: stacked, tiles 4 across, then Execution | Defect Summary side by side, then plot 140px;
 *  - >= 896px: one row, [left column | Execution | Defect Summary]. The left column holds the
 *    tiles on top and the Burndown below, filling whatever height the donuts leave (min 110px),
 *    so a wider left column means a wider chart. The left column's headings go screen-reader-only
 *    (no height to spare). Tiles sit 4 across once the left column is >= 480px (about 1100px
 *    container); narrower they are 2x2 and the block grows to fit.
 */
export function CycleKpiTiles({
  counts,
  total,
  runs,
  countsLoading,
  defectsLoading,
  defects,
  stepStats,
  cycle,
  calendar,
}: {
  counts: AioStatusCounts;
  total: number;
  runs: AioTestRun[] | undefined;
  countsLoading: boolean;
  defectsLoading: boolean;
  defects: ResolvedDefect[];
  stepStats: CycleStepStats;
  cycle: Pick<AioCycle, 'startDate' | 'endDate'> | undefined;
  calendar: WorkCalendar;
}) {
  // buildWorkCalendar returns a new object every render, so key the memo on its content.
  const { isWorkingDay, source } = calendar;
  const holidayKey = calendar.holidays.join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: isWorkingDay is a new closure per render; source + holidayKey capture its content
  const burndown = useMemo(
    () => (runs ? cycleBurndownSeries(runs, cycle, Date.now(), isWorkingDay) : null),
    [runs, cycle, source, holidayKey],
  );
  const executed = counts.pass + counts.fail + counts.blocked;
  const passPct = pctOf(counts.pass, executed);

  return (
    <div className={cn(STAT_CONTAINER_CLASS, 'flex-none border-b border-border py-4 pr-8 pl-6')}>
      <div className="flex flex-col gap-4 @4xl/epic:flex-row @min-[88rem]/epic:gap-8">
        <div className="@container/left flex min-w-0 flex-col gap-4 @4xl/epic:flex-1 @4xl/epic:gap-3">
          <Section
            title="Cycle Statistics"
            className="min-w-0"
            headingClassName={SIDE_HEADING_CLASS}
          >
            <div className="grid w-full min-w-0 grid-cols-4 gap-x-3 gap-y-4 @4xl/epic:@max-[30rem]/left:grid-cols-2">
              {countsLoading ? (
                <TileSkeleton testId="kpi-skeleton-pass" icon={CircleCheck} tint="green" />
              ) : (
                <Tile
                  testId="kpi-pass-rate"
                  icon={CircleCheck}
                  tint="green"
                  label="Pass rate"
                  value={<span className={VALUE_CLASS}>{executed > 0 ? `${passPct}%` : '—'}</span>}
                  sub={<span className="truncate">of executed</span>}
                  tip={
                    <TooltipBody title="Pass rate">
                      <TooltipRow
                        label="Passed"
                        value={counts.pass}
                        color="var(--color-green-500)"
                      />
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
              {stepStats.loading ? (
                <TileSkeleton testId="kpi-skeleton-step-pass" icon={ListChecks} tint="green" />
              ) : (
                <Tile
                  testId="kpi-step-pass-rate"
                  icon={ListChecks}
                  tint="green"
                  label="Step pass rate"
                  value={
                    <span className={VALUE_CLASS}>
                      {stepStats.executed > 0
                        ? `${pctOf(stepStats.passed, stepStats.executed)}%`
                        : '—'}
                    </span>
                  }
                  sub={<span className="truncate">of executed steps</span>}
                  tip={
                    <TooltipBody title="Step pass rate">
                      <TooltipRow
                        label="Passed"
                        value={stepStats.passed}
                        color="var(--color-green-500)"
                      />
                      <TooltipRow
                        label="Failed"
                        value={stepStats.failed}
                        color="var(--color-red-500)"
                      />
                      <TooltipRow
                        label="Blocked"
                        value={stepStats.blocked}
                        color="var(--color-orange-400)"
                      />
                    </TooltipBody>
                  }
                />
              )}
              {stepStats.loading ? (
                <TileSkeleton testId="kpi-skeleton-steps-executed" icon={Footprints} tint="blue" />
              ) : (
                <Tile
                  testId="kpi-steps-executed"
                  icon={Footprints}
                  tint="blue"
                  label="Steps executed"
                  value={
                    <span className={VALUE_CLASS}>
                      {stepStats.total > 0 ? `${pctOf(stepStats.executed, stepStats.total)}%` : '—'}
                    </span>
                  }
                  sub={
                    <span className="truncate">{`${stepStats.executed} of ${stepStats.total} steps`}</span>
                  }
                  tip={
                    <TooltipBody title="Steps executed">
                      <TooltipRow label="Executed" value={stepStats.executed} />
                      <TooltipRow label="Not run" value={stepStats.notRun} />
                      {stepStats.unavailable > 0 && (
                        <TooltipRow label="Unavailable" value={`${stepStats.unavailable} cases`} />
                      )}
                    </TooltipBody>
                  }
                />
              )}
              {stepStats.loading ? (
                <TileSkeleton testId="kpi-skeleton-steps-per-case" icon={Layers} tint="amber" />
              ) : (
                <Tile
                  testId="kpi-steps-per-case"
                  icon={Layers}
                  tint="amber"
                  label="Steps per case"
                  value={
                    <span className={VALUE_CLASS}>
                      {stepStats.cases > 0 ? (stepStats.total / stepStats.cases).toFixed(1) : '—'}
                    </span>
                  }
                  sub={<span className="truncate">{`${stepStats.total} steps total`}</span>}
                  tip={
                    <TooltipBody title="Steps per case">
                      <TooltipRow label="Min" value={stepStats.minPerCase} />
                      <TooltipRow label="Max" value={stepStats.maxPerCase} />
                    </TooltipBody>
                  }
                />
              )}
            </div>
          </Section>
          <Section
            title="Burndown"
            className={BURNDOWN_CLASS}
            headingClassName={SIDE_HEADING_CLASS}
            bodyClassName="relative min-h-[140px] items-stretch @4xl/epic:min-h-[110px]"
          >
            <CycleBurndown series={burndown} loading={!runs} noCases={runs?.length === 0} />
          </Section>
        </div>
        <div className="flex min-w-0 gap-6 @4xl/epic:contents">
          <Section
            title="Execution Distribution"
            className={cn(
              DIVIDED_CLASS,
              'min-w-0 flex-1 @4xl/epic:flex-none @min-[88rem]/epic:pl-8',
            )}
          >
            {/* Gate on runs like the burndown and defect charts so every graph reveals together,
                even when the summary-driven counts are ready first. */}
            <ExecutionDonut counts={counts} total={total} loading={countsLoading || !runs} />
          </Section>
          <Section
            title="Defect Summary"
            className={cn(
              DIVIDED_CLASS,
              'min-w-0 flex-1 border-l pl-6 @4xl/epic:flex-none @min-[88rem]/epic:w-112 @min-[88rem]/epic:pl-8 @min-[88rem]/epic:pr-4',
            )}
          >
            <CycleDefectDonuts defects={defects} loading={defectsLoading} />
          </Section>
        </div>
      </div>
    </div>
  );
}

/** Side-by-side columns are divided by a left rule, stacked ones by a left rule only. */
const DIVIDED_CLASS = '@4xl/epic:border-l @4xl/epic:border-border @4xl/epic:pl-6';

/** The left column's headings are visually hidden from 896px (screen readers keep them): no height to spare. */
const SIDE_HEADING_CLASS = '@4xl/epic:sr-only';

/** Burndown: below the tiles in the left column; stacked (< 896px) it has no divider. */
const BURNDOWN_CLASS = 'min-w-0 flex-1';

/** Headed block: heading on the shared top line, body vertically centred in the leftover height. */
function Section({
  title,
  className,
  headingClassName,
  bodyClassName,
  children,
}: {
  title: string;
  className?: string;
  headingClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h3 className={cn(HEADING_CLASS, headingClassName)}>{title}</h3>
      <div className={cn('flex min-w-0 flex-1 items-center', bodyClassName)}>{children}</div>
    </section>
  );
}
