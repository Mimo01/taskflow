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
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type AssigneeBucket,
  averageForecasts,
  type Bands,
  buildStatusCategoryLookup,
  type ChartRange,
  calendarNote,
  chartAxisStart,
  chartDomain,
  clampRange,
  dataSourceLines,
  deriveAdaptiveForecast,
  deriveAssigneeBuckets,
  deriveCfd,
  deriveRisks,
  deriveStatusBuckets,
  deriveSummary,
  deriveTimeForecast,
  deriveTimeTotals,
  formatMetric,
  HISTORY_SOURCE_TEXT,
  type HistorySource,
  type Metric,
  padToDomain,
  presetRange,
  projectFinish,
  type StatusBucket,
  type WorklogSource,
  withProjection,
  type ZoomPreset,
} from '@/lib/epic-progress';
import { toLocalDateString } from '@/lib/local-date';
import { statusCategoryColor, statusCategoryDotClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { BandBar, BandBreakdown, BandChips } from './EpicBands';
import { EpicCfdChart } from './EpicCfdChart';
import type { ChartZoom } from './EpicChartZoom';
import { EpicProgressSummary } from './EpicProgressSummary';
import { EpicTimeBurnup } from './EpicTimeBurnup';
import { MARKER_ICON } from './epic-markers';
import {
  useEpicStatusHistory,
  useEpicWorkCalendar,
  useEpicWorklogs,
  useJiraStatusList,
} from './useEpicProgressQueries';

interface EpicProgressSectionProps {
  epicKey: string;
  stories: JiraIssue[] | undefined;
  storyPointsFieldKey: string;
  epicCreated: string | undefined;
  /** The epic's own due date (YYYY-MM-DD), for the overdue / late risks. */
  epicDueDate?: string | null;
  /** Opens an issue (risk keys in the Risks popover). */
  onOpenIssue?: (key: string) => void;
}

const SECTION_CLASS = 'border-t border-b border-border py-5 my-6 space-y-5';
const METRICS = [
  ['count', 'Count'],
  ['sp', 'SP'],
  ['time', 'Time'],
] as const;

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
      <BandBreakdown bands={assigneeBands(a)} metric={metric} />
      {metric === 'time' ? (
        <>
          <TooltipRow
            icon={<MARKER_ICON.logged className="size-3" />}
            label="Logged"
            value={formatDuration(a.logged)}
          />
          <TooltipRow
            icon={<MARKER_ICON.estimate className="size-3" />}
            label="Estimate"
            value={formatDuration(a.estimate)}
          />
        </>
      ) : null}
    </TooltipBody>
  );
}

/** The assignee's three status bands in the active metric's unit (time = estimate seconds). */
function assigneeBands(a: AssigneeBucket): Bands {
  return { done: a.done, inProgress: a.inProgress, todo: a.todo };
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
      <Skeleton className="h-[252px] w-full" />
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
  epicDueDate,
  onOpenIssue,
}: EpicProgressSectionProps) {
  const [metric, setMetric] = useState<Metric>('count');
  const timeMode = metric === 'time';
  // Lifted zoom: shared by both charts and kept across tab switches (date-keyed, not indexes).
  const [zoom, setZoom] = useState<{
    preset: ZoomPreset | null;
    range: ChartRange | null;
    epoch: number;
  }>({ preset: 'all', range: null, epoch: 0 });
  // Hooks run before the early returns (rules of hooks). Worklogs load in every mode (after
  // first paint) because the averaged Finish includes the Time forecast.
  const storyKeys = (stories ?? []).map((s) => s.key);
  const worklogs = useEpicWorklogs(epicKey, storyKeys, true);
  const today = toLocalDateString(new Date());
  const { calendar } = useEpicWorkCalendar(today);
  // Status history + status list feed the Count/SP cumulative flow diagram only.
  const history = useEpicStatusHistory(epicKey, storyKeys, !timeMode);
  const statusList = useJiraStatusList(!timeMode);

  if (!stories) return <EpicProgressSkeleton />;
  if (stories.length === 0) return null;

  const statuses = deriveStatusBuckets(stories, metric, storyPointsFieldKey);
  const assignees = deriveAssigneeBuckets(stories, metric, storyPointsFieldKey);
  const summary = deriveSummary(stories, metric, storyPointsFieldKey);
  const time = deriveTimeTotals(stories);

  const countForecast = deriveAdaptiveForecast(
    stories,
    'count',
    storyPointsFieldKey,
    epicCreated,
    today,
    calendar,
  );
  const spForecast = deriveAdaptiveForecast(
    stories,
    'sp',
    storyPointsFieldKey,
    epicCreated,
    today,
    calendar,
  );
  const timeForecast = worklogs.data
    ? deriveTimeForecast(stories, worklogs.data, today, calendar)
    : null;
  // A disabled query stays pending forever: branch on isFetching, not isLoading alone.
  const timePending = worklogs.data
    ? undefined
    : worklogs.isError || !worklogs.isFetching
      ? ('error' as const)
      : ('loading' as const);
  const finish = averageForecasts(
    [
      { metric: 'count', forecast: countForecast },
      { metric: 'sp', forecast: spForecast },
      { metric: 'time', forecast: timeForecast, pending: timePending },
    ],
    today,
    calendar,
  );
  const risks = deriveRisks({
    stories,
    metric,
    spKey: storyPointsFieldKey,
    finish,
    dueDate: epicDueDate,
    today,
  });

  const statusTotal = statuses.reduce((n, b) => n + b.value, 0);
  const maxAssignee = Math.max(1, ...assignees.map((a) => a.done + a.inProgress + a.todo));

  // Cumulative flow (Count/SP): real status history when loaded, else the current-state
  // approximation. The chart is never replaced by a skeleton or error box.
  // Time mode renders EpicTimeBurnup instead — skip the CFD derivation there.
  const { points: cfdPoints, approximate } =
    metric === 'time'
      ? { points: [], approximate: false }
      : deriveCfd({
          stories,
          history: history.data ?? null,
          lookup: buildStatusCategoryLookup(statusList.data, stories),
          metric,
          spKey: storyPointsFieldKey,
          epicCreated,
          today,
        });
  // One forecast: the CFD projects the shared averaged finish from its own current remaining.
  const cfdToday = cfdPoints.length > 0 ? cfdPoints[cfdPoints.length - 1] : null;
  const axisStart = chartAxisStart(stories, epicCreated, today);
  const projection = projectFinish(finish, cfdToday?.remaining ?? 0, today, axisStart, calendar);
  // One x-domain and one zoom range for both charts, so switching tabs never shifts the axis.
  const domain = chartDomain(axisStart, today, finish);
  let chartZoom: ChartZoom | null = null;
  if (domain) {
    const forecastEnabled = presetRange('forecast', domain, today) !== null;
    // A stored Forecast preset that is no longer available shows as All (what's actually drawn).
    const preset = zoom.preset === 'forecast' && !forecastEnabled ? 'all' : zoom.preset;
    const wanted = preset ? (presetRange(preset, domain, today) ?? domain) : (zoom.range ?? domain);
    chartZoom = {
      domain,
      range: clampRange(wanted, domain),
      preset,
      forecastEnabled,
      epoch: zoom.epoch,
      onPreset: (preset) => setZoom((z) => ({ preset, range: null, epoch: z.epoch + 1 })),
      onRange: (range) => setZoom((z) => ({ preset: null, range, epoch: z.epoch })),
    };
  }
  const projectedCfd = withProjection(cfdPoints, projection);
  const cfdData = domain ? padToDomain(projectedCfd, domain.to) : projectedCfd;
  let historySource: HistorySource;
  if (history.data) historySource = approximate ? 'partial' : 'real';
  else if (history.isError || !history.isFetching) historySource = 'unavailable';
  else historySource = 'loading';
  const worklogSource: WorklogSource = worklogs.data
    ? 'loaded'
    : timePending === 'error'
      ? 'unavailable'
      : 'loading';
  const sources = dataSourceLines({
    metric,
    history: historySource,
    worklogs: worklogSource,
    calendarLine: calendarNote(calendar, today, finish.pessimistic),
  });

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
          finish={finish}
          risks={risks}
          sources={sources}
          onOpenIssue={onOpenIssue}
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
          <div className="flex flex-col">
            {timeMode ? (
              <EpicTimeBurnup
                query={worklogs}
                stories={stories}
                epicCreated={epicCreated}
                today={today}
                finish={finish}
                calendar={calendar}
                sourceFlag={null}
                zoom={chartZoom}
              />
            ) : (
              <EpicCfdChart
                data={cfdData}
                metric={metric}
                history={history.data && !approximate ? 'real' : 'approx'}
                sourceFlag={historySource === 'real' ? null : HISTORY_SOURCE_TEXT[historySource]}
                hasProjection={projection.points.length > 0}
                clippedAfter={projection.clippedAfter}
                finish={finish}
                today={today}
                zoom={chartZoom}
              />
            )}
            <div data-testid="epic-status-block" className="mt-3.5 flex flex-col gap-1.5">
              <Tooltip trackCursorAxis="x">
                <TooltipTrigger
                  delay={0}
                  render={<div />}
                  data-testid="epic-status-bar"
                  role="img"
                  tabIndex={0}
                  aria-label={`Status breakdown: ${statuses
                    .filter((b) => b.value > 0)
                    .map((b) => `${b.name} ${formatMetric(b.value, metric)}`)
                    .join(', ')}`}
                  className="py-1.5"
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
                    <span className={cn('size-2 rounded-[2px]', statusCategoryDotClass(b.cat))} />
                    <span>{`${b.name} · ${formatMetric(b.value, metric)}`}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4.5 flex flex-col">
              {assignees.map((a) => (
                <div key={a.id} data-testid="epic-assignee-row" className="text-xs">
                  <Tooltip trackCursorAxis="x">
                    <TooltipTrigger
                      delay={0}
                      render={<div />}
                      data-testid="epic-assignee-trigger"
                      // group, not img: its avatar and chips are role="img" children (no nested img roles).
                      role="group"
                      tabIndex={0}
                      aria-label={`${a.name}: done ${formatMetric(a.done, metric)}, in progress ${formatMetric(a.inProgress, metric)}, to do ${formatMetric(a.todo, metric)}`}
                      className="flex items-center gap-2 rounded-sm py-0.5 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <span className="flex w-40 min-w-0 flex-none items-center gap-1.5">
                        <CachedAvatar url={a.avatarUrl} name={a.name} size={20} />
                        <span className="truncate pr-0.5">{a.name}</span>
                      </span>
                      <div data-testid="epic-assignee-bar" className="min-w-0 flex-1">
                        <BandBar bands={assigneeBands(a)} scale={maxAssignee} className="h-3" />
                      </div>
                      <BandChips bands={assigneeBands(a)} metric={metric} />
                    </TooltipTrigger>
                    <TooltipContent>{assigneeTip(a, metric)}</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
