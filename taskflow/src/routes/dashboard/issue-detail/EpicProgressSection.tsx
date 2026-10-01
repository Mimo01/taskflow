'use no memo';

/**
 * EpicProgressSection — detailed progress panels for the epic detail view
 * (quick 261001-fmk, extended by 261001-g5q and 261001-hsz): burnup, status breakdown,
 * per-assignee breakdown, stat tiles, all driven by a Count / SP / Time toggle, as a
 * full-width divider-bounded section (no Card) with whole-bar hover/focus tooltips.
 * Time mode mounts EpicTimeBurnup, which lazily loads worklogs. Rendered above the Stories list.
 *
 * 'use no memo' + explicit-height wrapper + isAnimationActive={false}: Recharts
 * conventions shared with HoursCommitsChart (React Compiler / WebKit 0x0 guard).
 */
import { type ReactNode, useState } from 'react';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type AssigneeBucket,
  deriveAssigneeBuckets,
  deriveBurnup,
  deriveForecast,
  deriveStatusBuckets,
  deriveTimeTotals,
  ESTIMATE_FORMULA_NOTE,
  formatDateKey,
  formatMetric,
  type Metric,
  type StatusBucket,
} from '@/lib/epic-progress';
import { toLocalDateString } from '@/lib/local-date';
import { statusCategoryDotClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { EpicTimeBurnup } from './EpicTimeBurnup';

interface EpicProgressSectionProps {
  epicKey: string;
  stories: JiraIssue[] | undefined;
  storyPointsFieldKey: string;
  epicCreated: string | undefined;
}

const chartConfig = {
  scope: { label: 'Scope', color: 'var(--color-gray-400)' },
  done: { label: 'Done', color: 'var(--color-green-500)' },
} satisfies ChartConfig;

const TILE_CLASS = 'min-w-0 text-left';
const SECTION_CLASS = 'border-t border-b border-border py-5 my-6 space-y-5';
const BAR_CURSOR = { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' };
const METRICS = [
  ['count', 'Count'],
  ['sp', 'SP'],
  ['time', 'Time'],
] as const;

function Tile({ label, value, tip }: { label: string; value: string; tip: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        data-testid="epic-stat-tile"
        className={cn(TILE_CLASS, 'cursor-default')}
      >
        <span className="block text-xs text-muted-foreground truncate">{label}</span>
        <span className="block text-lg font-semibold leading-tight truncate">{value}</span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function statusBarTip(statuses: StatusBucket[], statusTotal: number, metric: Metric): ReactNode {
  return (
    <div className="space-y-1">
      {statuses
        .filter((b) => b.value > 0)
        .map((b) => {
          const pct = statusTotal > 0 ? Math.round((b.value / statusTotal) * 100) : 0;
          return (
            <div key={b.id} className="flex items-center gap-2">
              <span className={cn('size-2 shrink-0 rounded-full', statusCategoryDotClass(b.cat))} />
              <span>{b.name}</span>
              <span className="ml-auto pl-3 font-mono tabular-nums">
                {formatMetric(b.value, metric)}
              </span>
              <span className="text-muted-foreground tabular-nums">{`${pct}%`}</span>
            </div>
          );
        })}
    </div>
  );
}

function assigneeTip(a: AssigneeBucket, metric: Metric): ReactNode {
  return (
    <div className="space-y-0.5">
      <div className="font-medium">{a.name}</div>
      <div>{`done: ${formatMetric(a.done, metric)}`}</div>
      <div>{`in progress: ${formatMetric(a.inProgress, metric)}`}</div>
      <div>{`to do: ${formatMetric(a.todo, metric)}`}</div>
      {metric === 'time' ? (
        <div className="text-muted-foreground">{`${formatDuration(a.logged)} logged of ${formatDuration(a.estimate)}`}</div>
      ) : null}
    </div>
  );
}

function EpicProgressSkeleton() {
  return (
    <div data-testid="epic-progress-skeleton" className={SECTION_CLASS}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <Skeleton className="h-[220px] w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-4 w-2/3" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export function EpicProgressSection({
  epicKey,
  stories,
  storyPointsFieldKey,
  epicCreated,
}: EpicProgressSectionProps) {
  const [metric, setMetric] = useState<Metric>('count');

  if (!stories) return <EpicProgressSkeleton />;
  if (stories.length === 0) return null;

  const today = toLocalDateString(new Date());
  const burnup = deriveBurnup(stories, metric, storyPointsFieldKey, epicCreated, today);
  const statuses = deriveStatusBuckets(stories, metric, storyPointsFieldKey);
  const assignees = deriveAssigneeBuckets(stories, metric, storyPointsFieldKey);
  const forecast = deriveForecast(stories, metric, storyPointsFieldKey, today);
  const time = deriveTimeTotals(stories);

  const statusTotal = statuses.reduce((n, b) => n + b.value, 0);
  const maxAssignee = Math.max(1, ...assignees.map((a) => a.done + a.inProgress + a.todo));

  let finish: string;
  if (forecast.reason === 'done') finish = 'Complete';
  else if (forecast.reason === 'insufficient' || !forecast.finishDate) finish = 'Not enough data';
  else finish = formatDateKey(forecast.finishDate);

  const doneTip =
    metric === 'sp'
      ? `${formatMetric(forecast.doneTotal, 'sp')} of ${formatMetric(forecast.total, 'sp')} done`
      : `${forecast.doneTotal} of ${forecast.total} done`;
  const finishTip =
    forecast.reason === 'done'
      ? 'All stories are done'
      : forecast.reason === 'ok'
        ? 'Projected from throughput over the trailing 4 weeks'
        : 'Needs at least 2 stories completed in the trailing 4 weeks';

  const timeMode = metric === 'time';
  const chartData = burnup;

  return (
    <section aria-label="Epic progress" className={SECTION_CLASS}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Progress</h3>
        {/* biome-ignore lint/a11y/useSemanticElements: button toggle group; <fieldset> would add unwanted chrome */}
        <div role="group" aria-label="Progress metric" className="flex gap-1">
          {METRICS.map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={cn(
                'cursor-pointer rounded-md px-2 py-0.5 text-xs ring-1 ring-foreground/10',
                metric === m ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          {timeMode ? (
            <>
              <Tile
                label="Estimated"
                value={formatDuration(time.estimated)}
                tip={
                  <div className="space-y-0.5">
                    <div>{ESTIMATE_FORMULA_NOTE}</div>
                    <div className="text-muted-foreground">{formatDuration(time.estimated)}</div>
                  </div>
                }
              />
              <Tile
                label="Logged"
                value={formatDuration(time.logged)}
                tip={`Time logged, incl. subtasks: ${formatDuration(time.logged)}`}
              />
              <Tile
                label="Remaining"
                value={formatDuration(time.remaining)}
                tip="Open stories: estimate minus logged, never below 0. Replaces Jira's remaining estimate so it matches the chart."
              />
              <Tile
                label="% logged"
                value={time.pctLogged === null ? '—' : `${time.pctLogged}%`}
                tip={`${formatDuration(time.logged)} of ${formatDuration(time.estimated)}`}
              />
            </>
          ) : (
            <>
              <Tile label="% done" value={`${forecast.pctDone}%`} tip={doneTip} />
              <Tile label="Projected finish" value={finish} tip={finishTip} />
              <Tile
                label="Unestimated"
                value={String(forecast.unestimated)}
                tip={`${forecast.unestimated} without story points`}
              />
              <Tile
                label="Unassigned open"
                value={String(forecast.unassignedOpen)}
                tip={`${forecast.unassignedOpen} open with no assignee`}
              />
            </>
          )}
        </div>

        {metric === 'sp' && forecast.total === 0 ? (
          <p className="text-sm text-muted-foreground italic pr-0.5">
            No story points estimated — switch to Count
          </p>
        ) : timeMode && time.estimated === 0 ? (
          <p className="text-sm text-muted-foreground italic pr-0.5">
            No time estimated — switch to Count
          </p>
        ) : (
          <>
            {timeMode ? (
              <EpicTimeBurnup
                epicKey={epicKey}
                stories={stories}
                epicCreated={epicCreated}
                today={today}
              />
            ) : (
              <div>
                <div data-testid="epic-burnup" style={{ height: 220 }}>
                  {burnup.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No timeline data</p>
                  ) : (
                    <ChartContainer
                      config={chartConfig}
                      className="aspect-auto h-full w-full"
                      aria-label="Epic burnup chart"
                    >
                      <ComposedChart
                        data={chartData}
                        responsive
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => formatDateKey(String(v))}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          width={timeMode ? 40 : 32}
                          tickFormatter={(v) => (timeMode ? `${v}h` : String(v))}
                        />
                        <ChartTooltip
                          cursor={BAR_CURSOR}
                          content={
                            <ChartTooltipContent
                              labelFormatter={(v) =>
                                `${formatDateKey(String(v))}, ${String(v).slice(0, 4)}`
                              }
                              formatter={(value, name) => {
                                const key = String(name) as keyof typeof chartConfig;
                                return (
                                  <div className="flex w-full items-center gap-2">
                                    <span
                                      className="size-2 shrink-0 rounded-[2px]"
                                      style={{ background: `var(--color-${key})` }}
                                    />
                                    <span className="text-muted-foreground">
                                      {chartConfig[key]?.label ?? key}
                                    </span>
                                    <span className="ml-auto font-mono font-medium tabular-nums">
                                      {formatMetric(Number(value), metric)}
                                    </span>
                                  </div>
                                );
                              }}
                            />
                          }
                        />
                        <Area
                          dataKey="scope"
                          type="stepAfter"
                          stroke="var(--color-scope)"
                          fill="var(--color-scope)"
                          fillOpacity={0.15}
                          isAnimationActive={false}
                        />
                        <Line
                          dataKey="done"
                          type="stepAfter"
                          stroke="var(--color-done)"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ChartContainer>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Scope by story creation date</p>
              </div>
            )}

            <div className="space-y-2">
              <Tooltip trackCursorAxis="x">
                <TooltipTrigger
                  delay={0}
                  render={<div />}
                  data-testid="epic-status-bar"
                  tabIndex={0}
                  aria-label={`Status breakdown: ${statuses
                    .filter((b) => b.value > 0)
                    .map((b) => `${b.name} ${formatMetric(b.value, metric)}`)
                    .join(', ')}`}
                  className="py-1.5 -my-1.5"
                >
                  <div className="flex h-3 w-full gap-px overflow-hidden rounded bg-muted">
                    {statuses
                      .filter((b) => b.value > 0)
                      .map((b) => (
                        <div
                          key={b.id}
                          data-testid="epic-status-segment"
                          className={cn('h-full', statusCategoryDotClass(b.cat))}
                          style={{
                            width: `${statusTotal > 0 ? (b.value / statusTotal) * 100 : 0}%`,
                          }}
                        />
                      ))}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{statusBarTip(statuses, statusTotal, metric)}</TooltipContent>
              </Tooltip>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {statuses.map((b) => (
                  <span key={b.id} className="inline-flex items-center gap-1.5">
                    <span className={cn('size-2 rounded-full', statusCategoryDotClass(b.cat))} />
                    <span>{`${b.name} · ${b.count} · ${formatMetric(b.points, 'sp')}`}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              {assignees.map((a) => (
                <div
                  key={a.id}
                  data-testid="epic-assignee-row"
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-32 flex-none truncate pr-0.5">{a.name}</span>
                  <Tooltip trackCursorAxis="x">
                    <TooltipTrigger
                      delay={0}
                      render={<div />}
                      data-testid="epic-assignee-bar"
                      tabIndex={0}
                      aria-label={`${a.name}: done ${formatMetric(a.done, metric)}, in progress ${formatMetric(a.inProgress, metric)}, to do ${formatMetric(a.todo, metric)}`}
                      className="min-w-0 flex-1 py-1.5 -my-1.5"
                    >
                      <div className="flex h-3 w-full gap-px overflow-hidden rounded bg-muted">
                        {(
                          [
                            ['done', a.done],
                            ['indeterminate', a.inProgress],
                            ['new', a.todo],
                          ] as const
                        )
                          .filter(([, v]) => v > 0)
                          .map(([cat, v]) => (
                            <div
                              key={cat}
                              className={cn('h-full', statusCategoryDotClass(cat))}
                              style={{ width: `${(v / maxAssignee) * 100}%` }}
                            />
                          ))}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{assigneeTip(a, metric)}</TooltipContent>
                  </Tooltip>
                  <span
                    className={cn(
                      'flex-none truncate whitespace-nowrap text-right text-muted-foreground',
                      timeMode ? 'w-36' : 'w-14',
                    )}
                  >
                    {timeMode
                      ? `${formatDuration(a.logged)} / ${formatDuration(a.estimate)}`
                      : formatMetric(a.remaining, metric)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
