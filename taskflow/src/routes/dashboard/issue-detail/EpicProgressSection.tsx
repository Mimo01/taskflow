'use no memo';

/**
 * EpicProgressSection — detailed progress panels for the epic detail view
 * (quick 261001-fmk): burnup, status breakdown, per-assignee breakdown, stat tiles,
 * all driven by a Count / SP toggle. Rendered above the Stories list.
 *
 * 'use no memo' + explicit-height wrapper + isAnimationActive={false}: Recharts
 * conventions shared with HoursCommitsChart (React Compiler / WebKit 0x0 guard).
 */
import { useState } from 'react';
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  deriveAssigneeBuckets,
  deriveBurnup,
  deriveForecast,
  deriveStatusBuckets,
  formatDateKey,
  type Metric,
} from '@/lib/epic-progress';
import { toLocalDateString } from '@/lib/local-date';
import { statusCategoryDotClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';

interface EpicProgressSectionProps {
  stories: JiraIssue[] | undefined;
  storyPointsFieldKey: string;
  epicCreated: string | undefined;
}

const chartConfig = {
  scope: { label: 'Scope', color: 'var(--color-gray-400)' },
  done: { label: 'Done', color: 'var(--color-green-500)' },
} satisfies ChartConfig;

const TILE_CLASS = 'rounded-lg ring-1 ring-foreground/10 px-3 py-2 min-w-0';

function fmt(n: number, metric: Metric): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return metric === 'sp' ? `${v} SP` : v;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div data-testid="epic-stat-tile" className={TILE_CLASS}>
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="text-lg font-semibold leading-tight truncate">{value}</p>
    </div>
  );
}

function EpicProgressSkeleton() {
  return (
    <div data-testid="epic-progress-skeleton" className="space-y-3">
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
    </div>
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

  const statusTotal = statuses.reduce((n, b) => n + b.value, 0);
  const maxAssignee = Math.max(1, ...assignees.map((a) => a.done + a.inProgress + a.todo));

  let finish: string;
  if (forecast.reason === 'done') finish = 'Complete';
  else if (forecast.reason === 'insufficient' || !forecast.finishDate) finish = 'Not enough data';
  else finish = formatDateKey(forecast.finishDate);

  return (
    <section aria-label="Epic progress" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Progress</h3>
        {/* biome-ignore lint/a11y/useSemanticElements: button toggle group; <fieldset> would add unwanted chrome */}
        <div role="group" aria-label="Progress metric" className="flex gap-1">
          {(['count', 'sp'] as const).map((m) => (
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
              {m === 'count' ? 'Count' : 'SP'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="% done" value={`${forecast.pctDone}%`} />
        <Tile label="Projected finish" value={finish} />
        <Tile label="Unestimated" value={String(forecast.unestimated)} />
        <Tile label="Unassigned open" value={String(forecast.unassignedOpen)} />
      </div>

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
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
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
            <div
              key={b.name}
              data-testid="epic-status-segment"
              title={b.name}
              className={cn('h-full', statusCategoryDotClass(b.cat))}
              style={{ width: `${statusTotal > 0 ? (b.value / statusTotal) * 100 : 0}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {statuses.map((b) => (
            <span key={b.name} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', statusCategoryDotClass(b.cat))} />
              <span>{`${b.name} · ${b.count} · ${fmt(b.points, 'sp')}`}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {assignees.map((a) => (
          <div
            key={a.name}
            data-testid="epic-assignee-row"
            className="flex items-center gap-2 text-xs"
          >
            <span className="w-32 flex-none truncate pr-0.5" title={a.name}>
              {a.name}
            </span>
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
                  <div
                    key={cat}
                    className={cn('h-full', statusCategoryDotClass(cat))}
                    style={{ width: `${(v / maxAssignee) * 100}%` }}
                  />
                ))}
            </div>
            <span className="w-14 flex-none text-right text-muted-foreground">
              {fmt(a.remaining, metric)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
