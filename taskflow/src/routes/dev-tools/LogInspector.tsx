/**
 * LogInspector: detail pane for one captured API request.
 *
 * Summary header (method, status pill, full URL, meta line, Copy menu) over three collapsible
 * sections: Overview (general, query params, headers), Body (request and response side by side
 * when the inspector is wide, stacked when narrow) and Timing.
 */
import { useState } from 'react';
import { byteSize } from '../../lib/dev-tools/json-preview';
import { entryStart, isPending } from '../../lib/dev-tools/log-entry';
import { computeLogStats, timingScale } from '../../lib/dev-tools/log-stats';
import { parseQueryParams } from '../../lib/dev-tools/query-params';
import { queueSplit } from '../../lib/dev-tools/queue-handoff';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { SectionHeader } from '../dashboard/issue-detail/SectionHeader';
import { CopyMenu, KeyValueTable } from './dev-tools-ui';
import { useDevToolsViewStore } from './dev-tools-view.store';
import JsonTree from './JsonTree';
import { InspectorMaximizeButton } from './ListInspectorLayout';
import { copyActionsFor } from './log-copy-items';
import { useNow } from './useNow';
import { formatBytes, statusPillClass } from './utils';

function decodedUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function SubHead({ title, count }: { title: string; count?: number }) {
  return (
    <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">
      {title}
      {count !== undefined && <span className="ml-1.5 font-normal tabular-nums">{count}</span>}
    </h4>
  );
}

export default function LogInspector({
  entry,
  entries,
}: {
  entry: ApiLogEntry;
  entries: ApiLogEntry[];
}) {
  const [open, setOpen] = useState({ overview: true, body: true, timing: true });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const pending = isPending(entry);
  const pausedAt = useDevToolsViewStore((s) => s.pausedAt);
  const now = useNow(250, pending, pausedAt);
  const elapsed = Math.max(0, Math.round(now - entryStart(entry)));
  const url = decodedUrl(entry.url);
  const size = formatBytes(byteSize(entry.responseBody));
  const started = new Date(entry.timestamp);
  const meta = [
    `${pending ? elapsed : entry.durationMs} ms`,
    size === '-' ? null : size,
    started.toLocaleTimeString(),
    entry.source,
    entry.operation ?? null,
  ].filter((v): v is string => v !== null);

  return (
    <div data-testid="log-inspector">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">{entry.method}</span>
          <span className={statusPillClass(entry.status, pending)}>
            {pending ? 'pending' : (entry.status ?? 'ERR')}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <CopyMenu items={copyActionsFor(entry)} />
            <InspectorMaximizeButton />
          </div>
        </div>
        <p className="mt-2 font-mono text-xs break-all">{url}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{meta.join(' · ')}</p>
      </div>

      <section className="border-b px-4 pt-3 pb-2">
        <SectionHeader
          title="Overview"
          expanded={open.overview}
          onToggle={() => toggle('overview')}
          sticky={false}
        />
        {open.overview && <OverviewPanel entry={entry} size={size} pending={pending} />}
      </section>

      <section className="border-b px-4 pt-3 pb-3">
        <SectionHeader
          title="Body"
          expanded={open.body}
          onToggle={() => toggle('body')}
          sticky={false}
        />
        {open.body && <BodyPanel entry={entry} pending={pending} />}
      </section>

      <section className="px-4 pt-3 pb-3">
        <SectionHeader
          title="Timing"
          expanded={open.timing}
          onToggle={() => toggle('timing')}
          sticky={false}
        />
        {open.timing && <TimingPanel entry={entry} entries={entries} pending={pending} />}
      </section>
    </div>
  );
}

function OverviewPanel({
  entry,
  size,
  pending,
}: {
  entry: ApiLogEntry;
  size: string;
  pending: boolean;
}) {
  const params = parseQueryParams(entry.url);
  const requestHeaders = Object.entries(entry.requestHeaders);
  const responseHeaders = entry.responseHeaders ? Object.entries(entry.responseHeaders) : null;
  const started = new Date(entry.timestamp);
  const general: [string, string][] = [
    ['URL', decodedUrl(entry.url)],
    ['Method', entry.method],
    [
      'Status',
      pending ? 'pending' : entry.status === null ? 'Network error' : String(entry.status),
    ],
  ];
  if (!pending) general.push(['Duration', `${entry.durationMs} ms`]);
  const { queuedMs } = queueSplit(entry);
  if (queuedMs !== null) general.push(['Queued', `${queuedMs} ms`]);
  general.push(['Size', size], ['Started', `${entry.timestamp} (${started.toLocaleTimeString()})`]);
  return (
    <div className="flex flex-col gap-4">
      {entry.error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          <span className="font-semibold">Network error:</span> {entry.error}
        </p>
      )}
      <div>
        <SubHead title="General" />
        <KeyValueTable rows={general} />
      </div>
      {params.length > 0 && (
        <div>
          <SubHead title="Query parameters" count={params.length} />
          <KeyValueTable rows={params} />
        </div>
      )}
      <div>
        <SubHead title="Request headers" count={requestHeaders.length} />
        <KeyValueTable rows={requestHeaders} />
      </div>
      <div>
        <SubHead title="Response headers" count={responseHeaders?.length} />
        {responseHeaders ? (
          <KeyValueTable rows={responseHeaders} />
        ) : (
          <p className="text-xs text-muted-foreground">Not captured</p>
        )}
      </div>
    </div>
  );
}

function BodyPanel({ entry, pending }: { entry: ApiLogEntry; pending: boolean }) {
  const hasRequest = Boolean(entry.requestBody);
  return (
    <div className="@container">
      <div className={hasRequest ? 'grid gap-4 @[720px]:grid-cols-2' : 'grid gap-4'}>
        {hasRequest && <JsonTree label="Request" text={entry.requestBody} />}
        <div className="min-w-0">
          {entry.error && (
            <p className="mb-2 text-xs text-red-600 dark:text-red-400">
              <span className="font-semibold">Network error:</span> {entry.error}
            </p>
          )}
          {pending ? (
            <p className="text-xs text-muted-foreground">Waiting for response…</p>
          ) : entry.responseBody ? (
            <JsonTree label="Response" text={entry.responseBody} />
          ) : (
            !entry.error && (
              <p className="text-xs text-muted-foreground">Response body capture is off</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TimingPanel({
  entry,
  entries,
  pending,
}: {
  entry: ApiLogEntry;
  entries: ApiLogEntry[];
  pending: boolean;
}) {
  const stats = computeLogStats(entries);
  const started = new Date(entry.timestamp);
  const { queuedMs, networkMs } = queueSplit(entry);
  const rows: [string, string][] = [
    ['Started', `${entry.timestamp} (${started.toLocaleTimeString()})`],
    ['Queued', queuedMs === null ? '–' : `${queuedMs} ms`],
    ['Network', pending ? '–' : `${networkMs} ms`],
    ['Operation', entry.operation ?? '(none)'],
    ['Source', entry.source],
  ];
  if (stats.median !== null) rows.push(['Median (filtered)', `${stats.median} ms`]);
  if (stats.p95 !== null) rows.push(['p95 (filtered)', `${stats.p95} ms`]);
  if (!pending && stats.median && stats.median > 0) {
    rows.push(['Relative', `${(entry.durationMs / stats.median).toFixed(1)}x the median`]);
  }
  if (pending) {
    return (
      <div className="flex flex-col gap-3">
        <KeyValueTable rows={rows} />
        <p className="text-xs text-muted-foreground">Waiting for response…</p>
      </div>
    );
  }
  // Queue wait is drawn as a hatched lead-in before the network fill; the scale covers both.
  const queuePart = queuedMs ?? 0;
  const scale = timingScale(queuePart + entry.durationMs, stats.median, stats.p95);
  const queuedPct =
    queuePart > 0 ? Math.round((queuePart / (queuePart + entry.durationMs)) * 1000) / 10 : 0;
  return (
    <div className="flex flex-col gap-3">
      <KeyValueTable rows={rows} />
      <div>
        <div className="relative h-2 rounded bg-muted">
          <div className="flex h-full" style={{ width: `${scale.durationPct}%` }}>
            {queuePart > 0 && (
              <div
                data-testid="timing-queued"
                className="h-full rounded-l bg-muted-foreground/40 bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--color-background)_3px_5px)]"
                style={{ width: `${queuedPct}%` }}
              />
            )}
            <div className="h-full flex-1 rounded-r bg-primary/70" data-testid="timing-bar" />
          </div>
          {scale.medianPct !== null && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 h-3 w-px bg-foreground/70"
              style={{ left: `${scale.medianPct}%` }}
            />
          )}
          {scale.p95Pct !== null && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 h-3 w-px bg-foreground/30"
              style={{ left: `${scale.p95Pct}%` }}
            />
          )}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
          <span>{`this ${entry.durationMs} ms`}</span>
          {stats.median !== null && (
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="inline-block h-2.5 w-px bg-foreground/70" />
              {`median ${stats.median} ms`}
            </span>
          )}
          {stats.p95 !== null && (
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="inline-block h-2.5 w-px bg-foreground/30" />
              {`p95 ${stats.p95} ms`}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
