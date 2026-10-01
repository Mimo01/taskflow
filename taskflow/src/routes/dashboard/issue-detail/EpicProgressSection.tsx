'use no memo';

/**
 * EpicProgressSection — detailed progress panels for the epic detail view
 * (quick 261001-fmk, extended by 261001-g5q): burnup, status breakdown, per-assignee
 * breakdown, stat tiles, all driven by a Count / SP / Time toggle, inside a Card,
 * with hover/focus tooltips. Rendered above the Stories list.
 *
 * 'use no memo' + explicit-height wrapper + isAnimationActive={false}: Recharts
 * conventions shared with HoursCommitsChart (React Compiler / WebKit 0x0 guard).
 */
import { type ReactNode, useState } from 'react';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface EpicProgressSectionProps {
  stories: JiraIssue[] | undefined;
  storyPointsFieldKey: string;
  epicCreated: string | undefined;
}

const chartConfig = {
  scope: { label: 'Scope', color: 'var(--color-gray-400)' },
  done: { label: 'Done', color: 'var(--color-green-500)' },
} satisfies ChartConfig;

const TILE_CLASS = 'rounded-lg ring-1 ring-foreground/10 px-3 py-2 min-w-0 text-left';
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
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-semibold leading-tight truncate">{value}</p>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function statusTip(b: StatusBucket, statusTotal: number): ReactNode {
  const pct = statusTotal > 0 ? Math.round((b.value / statusTotal) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="font-medium">{b.name}</div>
      <div>{`${b.count} items · ${formatMetric(b.points, 'sp')} · ${formatDuration(b.seconds)} est`}</div>
      <div className="text-muted-foreground">{`${pct}% of total`}</div>
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
    </div>
  );
}

const CAT_LABEL = { done: 'done', indeterminate: 'in progress', new: 'to do' } as const;

function EpicProgressSkeleton() {
  return (
    <Card size="sm" data-testid="epic-progress-skeleton" className="my-2">
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-7 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <Skeleton className="h-[220px] w-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-4 w-2/3" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function EpicProgressSection({
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

  return (
    <section aria-label="Epic progress" className="my-2">
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h3 className="text-sm font-medium text-muted-foreground">Progress</h3>
          </CardTitle>
          <CardAction>
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
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {timeMode ? (
              <>
                <Tile
                  label="Estimated"
                  value={formatDuration(time.estimated)}
                  tip={`Original estimate, incl. subtasks: ${formatDuration(time.estimated)}`}
                />
                <Tile
                  label="Logged"
                  value={formatDuration(time.logged)}
                  tip={`Time logged, incl. subtasks: ${formatDuration(time.logged)}`}
                />
                <Tile
                  label="Remaining"
                  value={formatDuration(time.remaining)}
                  tip={`Remaining estimate, incl. subtasks: ${formatDuration(time.remaining)}`}
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
                        data={burnup}
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
                          tickFormatter={(v) =>
                            timeMode ? `${Math.round(Number(v) / 3600)}h` : String(v)
                          }
                        />
                        <ChartTooltip
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

              <div className="space-y-2">
                <div
                  data-testid="epic-status-bar"
                  className="flex h-3 w-full gap-px overflow-hidden rounded bg-background"
                >
                  {statuses.map((b) => (
                    <Tooltip key={b.id}>
                      <TooltipTrigger
                        render={<div />}
                        data-testid="epic-status-segment"
                        className={cn('h-full', statusCategoryDotClass(b.cat))}
                        style={{ width: `${statusTotal > 0 ? (b.value / statusTotal) * 100 : 0}%` }}
                      />
                      <TooltipContent>{statusTip(b, statusTotal)}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {statuses.map((b) => (
                    <Tooltip key={b.id}>
                      <TooltipTrigger
                        type="button"
                        className="inline-flex cursor-default items-center gap-1.5"
                      >
                        <span
                          className={cn('size-2 rounded-full', statusCategoryDotClass(b.cat))}
                        />
                        <span>{`${b.name} · ${b.count} · ${formatMetric(b.points, 'sp')}`}</span>
                      </TooltipTrigger>
                      <TooltipContent>{statusTip(b, statusTotal)}</TooltipContent>
                    </Tooltip>
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
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        className="w-32 flex-none cursor-default truncate pr-0.5 text-left"
                      >
                        {a.name}
                      </TooltipTrigger>
                      <TooltipContent>{assigneeTip(a, metric)}</TooltipContent>
                    </Tooltip>
                    <div className="flex h-3 min-w-0 flex-1 gap-px overflow-hidden rounded bg-background">
                      {(
                        [
                          ['done', a.done],
                          ['indeterminate', a.inProgress],
                          ['new', a.todo],
                        ] as const
                      )
                        .filter(([, v]) => v > 0)
                        .map(([cat, v]) => (
                          <Tooltip key={cat}>
                            <TooltipTrigger
                              render={<div />}
                              className={cn('h-full', statusCategoryDotClass(cat))}
                              style={{ width: `${(v / maxAssignee) * 100}%` }}
                            />
                            <TooltipContent>{`${CAT_LABEL[cat]}: ${formatMetric(v, metric)}`}</TooltipContent>
                          </Tooltip>
                        ))}
                    </div>
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        className={cn(
                          'flex-none cursor-default truncate whitespace-nowrap text-right text-muted-foreground',
                          timeMode ? 'w-28' : 'w-14',
                        )}
                      >
                        {timeMode
                          ? `${formatDuration(a.logged)} / ${formatDuration(a.estimate)}`
                          : formatMetric(a.remaining, metric)}
                      </TooltipTrigger>
                      <TooltipContent>{assigneeTip(a, metric)}</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
