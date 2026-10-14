import { BugOff, CircleCheck, FlaskConical, Repeat } from 'lucide-react';
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
 *  - >= 896px (@4xl): tiles 2x2 | Execution | Defect Summary (two donuts stacked) in one row.
 */
export function CycleKpiTiles({
  counts,
  total,
  runs,
  countsLoading,
  defectsLoading,
  defects,
}: {
  counts: AioStatusCounts;
  total: number;
  runs: AioTestRun[] | undefined;
  countsLoading: boolean;
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
      <div className="flex flex-col gap-6 @4xl/epic:flex-row @4xl/epic:gap-8">
        <Section title="Cycle Statistics" className="min-w-0 flex-1">
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
            {!runs ? (
              <TileSkeleton testId="kpi-skeleton-reruns" icon={Repeat} tint="amber" />
            ) : (
              <Tile
                testId="kpi-reruns"
                icon={Repeat}
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

        {/* One row when wide (rules with 24px each side); stacked with hairlines when narrow. */}
        <Section title="Execution Distribution" className={DIVIDED_CLASS}>
          <ExecutionDonut counts={counts} total={total} loading={countsLoading} />
        </Section>
        <Section
          title="Defect Summary"
          className={cn(DIVIDED_CLASS, '@4xl/epic:min-w-72 @4xl/epic:pr-4')}
        >
          <div className="grid w-full min-w-0 gap-5">
            <CycleDefectDonuts defects={defects} loading={defectsLoading} />
          </div>
        </Section>
      </div>
    </div>
  );
}

const DIVIDED_CLASS =
  'flex-none border-t border-border pt-6 @4xl/epic:border-t-0 @4xl/epic:border-l @4xl/epic:pt-0 @4xl/epic:pl-8';

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
