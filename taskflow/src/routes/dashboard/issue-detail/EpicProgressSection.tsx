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
import { CachedAvatar } from '@/components/ui/cached-avatar';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type AssigneeBucket,
  CAT_LABEL,
  type Cat,
  deriveAdaptiveForecast,
  deriveAssigneeBuckets,
  deriveBurnup,
  deriveStatusBuckets,
  deriveSummary,
  deriveTimeForecast,
  deriveTimeTotals,
  type EpicForecast,
  formatDateKey,
  formatMetric,
  type Metric,
  type StatusBucket,
} from '@/lib/epic-progress';
import { toLocalDateString } from '@/lib/local-date';
import {
  STATUS_CATEGORY_COLOR,
  statusCategoryBadgeClass,
  statusCategoryColor,
  statusCategoryDotClass,
} from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { EpicProgressSummary, type ForecastStatus } from './EpicProgressSummary';
import { EpicTimeBurnup } from './EpicTimeBurnup';
import { useEpicWorklogs } from './useEpicProgressQueries';

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

const SECTION_CLASS = 'border-t border-b border-border py-5 my-6 space-y-5';
const BAR_CURSOR = { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' };
const METRICS = [
  ['count', 'Count'],
  ['sp', 'SP'],
  ['time', 'Time'],
] as const;
const CHIP_CLASS = 'min-w-[2.25rem] rounded px-1 text-center text-[11px] tabular-nums';
const TIME_CHIP_CLASS =
  'min-w-[3.5rem] rounded px-1 text-center text-[11px] tabular-nums whitespace-nowrap';

function statusBarTip(statuses: StatusBucket[], statusTotal: number, metric: Metric): ReactNode {
  return (
    <TooltipBody>
      {statuses
        .filter((b) => b.value > 0)
        .map((b) => (
          <TooltipRow
            key={b.id}
            color={statusCategoryColor(b.cat)}
            label={b.name}
            value={formatMetric(b.value, metric)}
            sub={`${statusTotal > 0 ? Math.round((b.value / statusTotal) * 100) : 0}%`}
          />
        ))}
    </TooltipBody>
  );
}

function assigneeTip(a: AssigneeBucket, metric: Metric): ReactNode {
  return (
    <TooltipBody title={a.name}>
      <TooltipRow
        color={STATUS_CATEGORY_COLOR.done}
        label={CAT_LABEL.done}
        value={formatMetric(a.done, metric)}
      />
      <TooltipRow
        color={STATUS_CATEGORY_COLOR.indeterminate}
        label={CAT_LABEL.indeterminate}
        value={formatMetric(a.inProgress, metric)}
      />
      <TooltipRow
        color={STATUS_CATEGORY_COLOR.new}
        label={CAT_LABEL.new}
        value={formatMetric(a.todo, metric)}
      />
      {metric === 'time' ? (
        <>
          <TooltipRow
            color={STATUS_CATEGORY_COLOR.done}
            label="Logged"
            value={formatDuration(a.logged)}
          />
          <TooltipRow
            color={STATUS_CATEGORY_COLOR.new}
            label="Estimate"
            value={formatDuration(a.estimate)}
          />
        </>
      ) : null}
    </TooltipBody>
  );
}

/** Numbers-only chip text (no unit suffix); the category word lives in the aria-label. */
function chipNumber(n: number): string {
  return String(Number.isInteger(n) ? n : Math.round(n * 10) / 10);
}

function AssigneeChips({ a, metric }: { a: AssigneeBucket; metric: Metric }) {
  if (metric === 'time') {
    return (
      <span className="flex flex-none items-center gap-1">
        <span
          role="img"
          data-testid="epic-assignee-chip"
          data-cat="done"
          aria-label={`logged ${formatDuration(a.logged)}`}
          className={cn(
            TIME_CHIP_CLASS,
            statusCategoryBadgeClass('done'),
            a.logged === 0 && 'opacity-40',
          )}
        >
          {formatDuration(a.logged)}
        </span>
        <span
          role="img"
          data-testid="epic-assignee-chip"
          data-cat="new"
          aria-label={`estimate ${formatDuration(a.estimate)}`}
          className={cn(
            TIME_CHIP_CLASS,
            statusCategoryBadgeClass('new'),
            a.estimate === 0 && 'opacity-40',
          )}
        >
          {formatDuration(a.estimate)}
        </span>
      </span>
    );
  }
  const slots: [Cat, number][] = [
    ['done', a.done],
    ['indeterminate', a.inProgress],
    ['new', a.todo],
  ];
  return (
    <span className="flex flex-none items-center gap-1">
      {slots.map(([cat, v]) => (
        <span
          key={cat}
          role="img"
          data-testid="epic-assignee-chip"
          data-cat={cat}
          aria-label={`${CAT_LABEL[cat].toLowerCase()} ${chipNumber(v)}`}
          className={cn(CHIP_CLASS, statusCategoryBadgeClass(cat), v === 0 && 'opacity-40')}
        >
          {chipNumber(v)}
        </span>
      ))}
    </span>
  );
}

function EpicProgressSkeleton() {
  return (
    <div data-testid="epic-progress-skeleton" className={SECTION_CLASS}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <Skeleton className="h-16 sm:col-span-3 lg:col-span-1" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12" />
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
  const timeMode = metric === 'time';
  // Hooks run before the early returns (rules of hooks); worklogs load only in Time mode.
  const worklogs = useEpicWorklogs(
    epicKey,
    (stories ?? []).map((s) => s.key),
    timeMode,
  );

  if (!stories) return <EpicProgressSkeleton />;
  if (stories.length === 0) return null;

  const today = toLocalDateString(new Date());
  const burnup = deriveBurnup(stories, metric, storyPointsFieldKey, epicCreated, today);
  const statuses = deriveStatusBuckets(stories, metric, storyPointsFieldKey);
  const assignees = deriveAssigneeBuckets(stories, metric, storyPointsFieldKey);
  const summary = deriveSummary(stories, metric, storyPointsFieldKey);
  const time = deriveTimeTotals(stories);

  let forecast: EpicForecast | null;
  let forecastStatus: ForecastStatus = 'ready';
  if (timeMode) {
    if (worklogs.data) forecast = deriveTimeForecast(stories, worklogs.data, today);
    else {
      forecast = null;
      // A disabled query stays pending forever: branch on isFetching, not isLoading alone.
      forecastStatus = worklogs.isError || !worklogs.isFetching ? 'error' : 'loading';
    }
  } else {
    forecast = deriveAdaptiveForecast(stories, metric, storyPointsFieldKey, epicCreated, today);
  }

  const statusTotal = statuses.reduce((n, b) => n + b.value, 0);
  const maxAssignee = Math.max(1, ...assignees.map((a) => a.done + a.inProgress + a.todo));
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
        <EpicProgressSummary
          metric={metric}
          summary={summary}
          time={time}
          forecast={forecast}
          forecastStatus={forecastStatus}
          today={today}
        />

        {metric === 'sp' && summary.total === 0 ? (
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
                query={worklogs}
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
                  <span className="flex w-40 min-w-0 flex-none items-center gap-1.5">
                    <CachedAvatar url={a.avatarUrl} name={a.name} size={20} />
                    <span className="truncate pr-0.5">{a.name}</span>
                  </span>
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
                  <AssigneeChips a={a} metric={metric} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
