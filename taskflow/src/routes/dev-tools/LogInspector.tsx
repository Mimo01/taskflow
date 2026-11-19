/**
 * LogInspector — detail pane for one captured API request:
 * Headers / Request / Response / Timing, plus Copy URL / Copy as cURL / Copy response.
 */
import { useState } from 'react';
import { buildCurl } from '../../lib/dev-tools/curl';
import { byteSize } from '../../lib/dev-tools/json-preview';
import { computeLogStats } from '../../lib/dev-tools/log-stats';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { SectionSegmented } from '../dashboard/issue-detail/SectionHeader';
import { CopyButton, JsonBlock, KeyValueTable } from './dev-tools-ui';
import { formatBody, formatBytes } from './utils';

type Tab = 'headers' | 'request' | 'response' | 'timing';

const TABS: { value: Tab; label: string }[] = [
  { value: 'headers', label: 'Headers' },
  { value: 'request', label: 'Request' },
  { value: 'response', label: 'Response' },
  { value: 'timing', label: 'Timing' },
];

function decodedUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

export default function LogInspector({
  entry,
  entries,
}: {
  entry: ApiLogEntry;
  entries: ApiLogEntry[];
}) {
  const [tab, setTab] = useState<Tab>('headers');
  const url = decodedUrl(entry.url);

  return (
    <div data-testid="log-inspector">
      <div className="border-b px-4 py-3">
        <p className="font-mono text-xs break-all">
          <span className="font-semibold">{entry.method}</span> {url}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CopyButton label="Copy URL" getText={() => entry.url} />
          <CopyButton label="Copy as cURL" getText={() => buildCurl(entry)} />
          <CopyButton label="Copy response" getText={() => entry.responseBody} />
        </div>
      </div>
      <div className="border-b px-4 py-2">
        <SectionSegmented label="Inspector section" options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'headers' && (
        <div className="px-4 py-3">
          <KeyValueTable rows={Object.entries(entry.requestHeaders)} />
        </div>
      )}

      {tab === 'request' && (
        <div className="px-4 py-3">
          {entry.requestBody ? (
            <JsonBlock text={formatBody(entry.requestBody)} />
          ) : (
            <p className="text-xs text-muted-foreground">No request body</p>
          )}
        </div>
      )}

      {tab === 'response' && (
        <div className="px-4 py-3">
          {entry.error && (
            <p className="mb-2 text-xs text-red-600 dark:text-red-400">
              <span className="font-semibold">Network error:</span> {entry.error}
            </p>
          )}
          {entry.responseBody ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {formatBytes(byteSize(entry.responseBody))}
              </p>
              <JsonBlock text={formatBody(entry.responseBody)} />
            </>
          ) : (
            !entry.error && (
              <p className="text-xs text-muted-foreground">Response body capture is off</p>
            )
          )}
        </div>
      )}

      {tab === 'timing' && <TimingPanel entry={entry} entries={entries} />}
    </div>
  );
}

function TimingPanel({ entry, entries }: { entry: ApiLogEntry; entries: ApiLogEntry[] }) {
  const stats = computeLogStats(entries);
  const started = new Date(entry.timestamp);
  const rows: [string, string][] = [
    ['Started', `${entry.timestamp} (${started.toLocaleTimeString()})`],
    ['Duration', `${entry.durationMs} ms`],
    ['Operation', entry.operation ?? '(none)'],
    ['Source', entry.source],
  ];
  if (stats.median !== null) rows.push(['Median (filtered)', `${stats.median} ms`]);
  if (stats.slowest) rows.push(['Slowest (filtered)', `${stats.slowest.ms} ms`]);
  const vsMedian =
    stats.median && stats.median > 0
      ? `${(entry.durationMs / stats.median).toFixed(1)}x the median`
      : null;
  if (vsMedian) rows.push(['Relative', vsMedian]);
  return (
    <div className="px-4 py-3">
      <KeyValueTable rows={rows} />
    </div>
  );
}
