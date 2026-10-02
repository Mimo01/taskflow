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
  chartAxisStart,
  chartDomain,
  clampRange,
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
  rebaseRange,
  type StatusBucket,
  sourceNote,
  visiblePresets,
  WORKLOG_SOURCE_TEXT,
  type WorklogSource,
  withProjection,
  ZOOM_MIN_SPAN_DAYS,
  type ZoomPreset,
} from '@/lib/epic-progress';
import { toLocalDateString } from '@/lib/local-date';
import { statusCategoryColor, statusCategoryDotClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { BandBar, BandBreakdown, BandChips } from './EpicBands';
import { EpicCfdChart } from './EpicCfdChart';
import {
  ChartToolbar,
  type ChartZoom,
  chartHeight,
  PLOT_HEIGHT,
  TOOLBAR_HEIGHT,
} from './EpicChartZoom';
import { EpicProgressSummary } from './EpicProgressSummary';
import { STAT_CONTAINER_CLASS, STAT_GRID_CLASS } from './EpicStatCard';
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

function statusBarTip(statuses: StatusBucket[], statusTotal: number): ReactNode {
  return (
    <TooltipBody>
      {statuses
        .filter((b) => b.value > 0)
        .map((b) => (
          <TooltipRow
            key={b.id}
            color={statusCategoryColor(b.cat)}
            label={b.name}
            value={`${statusTotal > 0 ? Math.round((b.value / statusTotal) * 100) : 0}%`}
          />
        ))}
    </TooltipBody>
  );
}

function assigneeTip(a: AssigneeBucket, metric: Metric): ReactNode {
  return (
    <TooltipBody title={a.name}>
      <BandBreakdown bands={assigneeBands(a)} metric={metric} valueAs="share" />
      {metric === 'time' ? (
        <TooltipRow
          icon={<MARKER_ICON.logged className="size-3" />}
          label="Logged"
          value={formatDuration(a.logged)}
        />
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
        <Skeleton className="h-5 w-32" />
      </div>
      <div className={STAT_CONTAINER_CLASS}>
        <div className={STAT_GRID_CLASS}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      </div>
      {/* The domain is unknown while loading: reserve the non-zoom plot height (a jump to the
          taller zoomable chart is an accepted limitation). */}
      <div className="pt-3">
        <Skeleton className="w-full" style={{ height: PLOT_HEIGHT + TOOLBAR_HEIGHT + 8 }} />
      </div>
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
  // The state is tagged with the epic it belongs to, so a different epic starts at All.
  const [zoom, setZoom] = useState<{
    epicKey: string;
    preset: ZoomPreset | null;
    range: ChartRange | null;
    /** The domain end when `range` was chosen (a range pinned to it follows a grown domain). */
    domainTo: string | null;
  }>({ epicKey, preset: 'all', range: null, domainTo: null });
  if (zoom.epicKey !== epicKey) {
    setZoom({ epicKey, preset: 'all', range: null, domainTo: null });
  }
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
    const presets = visiblePresets(domain, today);
    const enabled = presets.length > 0;
    // Zoom chrome disappears for short domains: drop any stored zoom (adjust state while rendering).
    if (!enabled && (zoom.preset !== 'all' || zoom.range !== null)) {
      setZoom({ epicKey, preset: 'all', range: null, domainTo: null });
    }
    // A stored preset that is no longer shown (e.g. Forecast without a future) falls back to All.
    const preset = !enabled
      ? 'all'
      : zoom.preset && !presets.includes(zoom.preset)
        ? 'all'
        : zoom.preset;
    const wanted = !enabled
      ? domain
      : preset
        ? (presetRange(preset, domain, today) ?? domain)
        : zoom.range
          ? rebaseRange(zoom.range, zoom.domainTo ?? domain.to, domain, ZOOM_MIN_SPAN_DAYS)
          : domain;
    chartZoom = {
      domain,
      range: clampRange(wanted, domain, ZOOM_MIN_SPAN_DAYS),
      preset,
      enabled,
      presets,
      onPreset: (preset) => setZoom({ epicKey, preset, range: null, domainTo: null }),
      onRange: (range) => setZoom({ epicKey, preset: null, range, domainTo: domain.to }),
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
  const emptyEstimate =
    (metric === 'sp' && summary.total === 0) || (timeMode && time.estimated === 0);
  const heroSourceNote = sourceNote({
    metric,
    history: historySource,
    worklogs: worklogSource,
    calendar,
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
      <EpicProgressSummary
        metric={metric}
        summary={summary}
        time={time}
        finish={finish}
        risks={risks}
        sourceNote={heroSourceNote}
        onOpenIssue={onOpenIssue}
        today={today}
      />

      <div data-testid="epic-chart-block" className="flex flex-col pt-3">
        <ChartToolbar
          zoom={emptyEstimate ? null : chartZoom}
          sourceFlag={
            emptyEstimate
              ? null
              : timeMode
                ? worklogSource === 'loaded'
                  ? null
                  : WORKLOG_SOURCE_TEXT[worklogSource]
                : historySource === 'real'
                  ? null
                  : HISTORY_SOURCE_TEXT[historySource]
          }
        />
        {emptyEstimate ? (
          <div
            data-testid="epic-empty-estimate"
            style={{ minHeight: chartHeight(chartZoom) }}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <span className="italic pr-0.5">
              {metric === 'sp' ? 'No story points estimated' : 'No time estimated'}
            </span>
            <button
              type="button"
              onClick={() => setMetric('count')}
              className="cursor-pointer text-foreground underline underline-offset-2 hover:no-underline"
            >
              Switch to Count
            </button>
          </div>
        ) : timeMode ? (
          <EpicTimeBurnup
            query={worklogs}
            stories={stories}
            epicCreated={epicCreated}
            today={today}
            finish={finish}
            calendar={calendar}
            zoom={chartZoom}
          />
        ) : (
          <EpicCfdChart
            data={cfdData}
            metric={metric}
            history={history.data && !approximate ? 'real' : 'approx'}
            clippedAfter={projection.clippedAfter}
            finish={finish}
            today={today}
            zoom={chartZoom}
          />
        )}
        <div data-testid="epic-status-block" className="mt-4 flex flex-col gap-1.5">
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
            <TooltipContent>{statusBarTip(statuses, statusTotal)}</TooltipContent>
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

        <div className="mt-4 flex flex-col">
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
    </section>
  );
}
