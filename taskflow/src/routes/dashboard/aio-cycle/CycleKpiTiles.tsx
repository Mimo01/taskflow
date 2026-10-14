import { BugOff, CircleCheck, FlaskConical, Redo2 } from 'lucide-react';
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

const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** Detail-page section heading (same as Progress / Activity / run sections). */
const HEADING_CLASS = 'text-sm font-medium leading-5 text-muted-foreground';

/**
 * Cycle stats block: Cycle Statistics tiles | Execution Distribution donut | Defect Summary
 * donuts. Every figure appears once: the donut carries the per-status split (the Executions
 * tab chips carry the counts), the header carries the last run date, so the tiles show only
 * what those cannot (pass rate of executed, re-runs, unlinked failures, open defects).
 *
 * A Burndown column (remaining cases over time against a working-day ideal) is part of the
 * block; it is hidden when nothing has been executed. The plot is absolutely positioned inside
 * its section, so it never adds height: the sibling columns set the row height and it fills it.
 *
 * Three layouts on the block's own container width. The donuts always share the first row
 * with the tiles from 896px up; only the Burndown moves:
 *  - < 896px: everything stacked, tiles 2x2, plot 140px;
 *  - 896-1199px (@4xl): [tiles | Execution | Defect Summary], Burndown as a full-width row below;
 *  - >= 1200px (75rem): one row of four, tiles | Burndown | Execution | Defect Summary
 *    (Defect Summary: Status on top, Priority | Severity below); from 1408px (88rem) the gaps
 *    widen and Defect Summary gets its fixed width.
 */
export function CycleKpiTiles({
  counts,
  total,
  runs,
  countsLoading,
  defectsLoading,
  defects,
  cycle,
  calendar,
}: {
  counts: AioStatusCounts;
  total: number;
  runs: AioTestRun[] | undefined;
  countsLoading: boolean;
  defectsLoading: boolean;
  defects: ResolvedDefect[];
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
  const reRunList = (runs ?? []).filter((r) => (r.runCount ?? 0) > 1);
  const reRuns = reRunList.length;
  const maxRuns = reRunList.reduce((m, r) => Math.max(m, r.runCount ?? 0), 0);
  const unlinked = (runs ?? []).filter(
    (r) => (r.status === 'FAIL' || r.status === 'BLOCKED') && (r.jiraDefectIDs?.length ?? 0) === 0,
  );
  const failedNoDefect = unlinked.filter((r) => r.status === 'FAIL').length;
  const blockedNoDefect = unlinked.filter((r) => r.status === 'BLOCKED').length;
  // Same source (the runs list) as the unlinked / retest numerators, so "N of M failing"
  // can never read N > M even when the cycle summary and the runs list disagree.
  const failing = (runs ?? []).filter((r) => r.status === 'FAIL' || r.status === 'BLOCKED').length;
  // Failing cases whose linked defects are all Done: the fix is in, the case needs another run.
  const doneDefects = new Set(
    defects
      .filter((d) => d.issue?.fields.status?.statusCategory?.key === 'done')
      .map((d) => d.defectKey),
  );
  const retest = (runs ?? []).filter((r) => {
    const ids = (r.jiraDefectIDs ?? []).map(String);
    return (
      (r.status === 'FAIL' || r.status === 'BLOCKED') &&
      ids.length > 0 &&
      ids.every((id) => doneDefects.has(id))
    );
  });
  const retestFailed = retest.filter((r) => r.status === 'FAIL').length;

  return (
    <div className={cn(STAT_CONTAINER_CLASS, 'flex-none border-b border-border py-4 pr-8 pl-6')}>
      <div className="flex flex-col gap-6 @4xl/epic:flex-row @4xl/epic:flex-wrap @min-[88rem]/epic:gap-8">
        <Section
          title="Cycle Statistics"
          className="min-w-0 flex-1 @4xl/epic:min-w-48 @min-[75rem]/epic:min-w-72"
        >
          <div className="grid w-full min-w-0 grid-cols-2 gap-x-6 gap-y-4">
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
            {!runs || defectsLoading ? (
              <TileSkeleton testId="kpi-skeleton-retest" icon={FlaskConical} tint="blue" />
            ) : (
              <Tile
                testId="kpi-retest"
                icon={FlaskConical}
                tint="blue"
                label="Ready to retest"
                value={<span className={VALUE_CLASS}>{retest.length}</span>}
                sub={<span className="truncate">{`of ${failing} failing`}</span>}
                tip={
                  <TooltipBody title="Ready to retest">
                    <TooltipRow
                      label="Failed, defects done"
                      value={retestFailed}
                      color="var(--color-red-500)"
                    />
                    <TooltipRow
                      label="Blocked, defects done"
                      value={retest.length - retestFailed}
                      color="var(--color-orange-400)"
                    />
                  </TooltipBody>
                }
              />
            )}
            {!runs ? (
              <TileSkeleton testId="kpi-skeleton-unlinked" icon={BugOff} tint="red" />
            ) : (
              <Tile
                testId="kpi-unlinked"
                icon={BugOff}
                tint="red"
                label="Unlinked failures"
                value={<span className={VALUE_CLASS}>{unlinked.length}</span>}
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
            {!runs ? (
              <TileSkeleton testId="kpi-skeleton-reruns" icon={Redo2} tint="amber" />
            ) : (
              <Tile
                testId="kpi-reruns"
                icon={Redo2}
                tint="amber"
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
          </div>
        </Section>
        {!runs || burndown ? (
          <Section
            title="Burndown"
            className={BURNDOWN_CLASS}
            bodyClassName="relative min-h-[140px] items-stretch"
          >
            <CycleBurndown series={burndown} loading={!runs} />
          </Section>
        ) : null}
        <Section
          title="Execution Distribution"
          className={cn(DIVIDED_CLASS, '@min-[88rem]/epic:pl-8')}
        >
          <ExecutionDonut counts={counts} total={total} loading={countsLoading} />
        </Section>
        <Section
          title="Defect Summary"
          className={cn(
            DIVIDED_CLASS,
            '@min-[88rem]/epic:w-112 @min-[88rem]/epic:pl-8 @min-[88rem]/epic:pr-4',
          )}
        >
          <CycleDefectDonuts defects={defects} loading={defectsLoading} />
        </Section>
      </div>
    </div>
  );
}

/** Side-by-side columns are divided by a left rule, stacked ones by a top hairline. */
const DIVIDED_CLASS =
  'flex-none border-t border-border pt-6 @4xl/epic:border-t-0 @4xl/epic:border-l @4xl/epic:pt-0 @4xl/epic:pl-6';

/**
 * Burndown placement: stacked (< 896px) and in the narrow band it is a full-width row (last);
 * from 75rem it joins the single row, between the tiles and the donuts, and fills what is left.
 */
const BURNDOWN_CLASS =
  'min-w-0 border-t border-border pt-6 @4xl/epic:order-last @4xl/epic:w-full @min-[75rem]/epic:order-none @min-[75rem]/epic:w-auto @min-[75rem]/epic:min-w-66 @min-[75rem]/epic:flex-1 @min-[75rem]/epic:border-t-0 @min-[75rem]/epic:border-l @min-[75rem]/epic:pt-0 @min-[75rem]/epic:pl-6 @min-[88rem]/epic:pl-8';

/** Headed block: heading on the shared top line, body vertically centred in the leftover height. */
function Section({
  title,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h3 className={HEADING_CLASS}>{title}</h3>
      <div className={cn('flex min-w-0 flex-1 items-center', bodyClassName)}>{children}</div>
    </section>
  );
}
