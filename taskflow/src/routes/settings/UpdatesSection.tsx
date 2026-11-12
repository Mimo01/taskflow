/**
 * UpdatesSection — Settings section for update controls and version history.
 *
 * Contains:
 * - Current version display
 * - Update check frequency dropdown (reads/writes settings store)
 * - Check Now button with inline status feedback
 * - Last checked timestamp (relative time)
 * - VersionHistory: all releases (shared useReleaseHistory query), grouped by minor version,
 *   latest 8 with "Show older versions", notes via ReleaseNotesBody
 */

import { compareVersions } from 'compare-versions';
import { CheckCircle, Loader2, PackageOpen, WifiOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ReleaseNotesBody } from '@/components/update/ReleaseNotesBody';
import { useReleaseHistory } from '@/hooks/useReleaseHistory';
import { buildInfo } from '@/lib/build-info';
import { parseReleaseNotes, summarizeNotes } from '@/lib/release-notes/parse';
import { cn } from '@/lib/utils';
import type { ReleaseEntry } from '@/services/releases';
import { updaterService } from '@/services/updater';
import { useDebugLogStore } from '@/stores/debug-log.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useUpdateStore } from '@/stores/update.store';

const FREQUENCY_OPTIONS = [
  { value: '1', label: 'Every hour' },
  { value: '6', label: 'Every 6 hours' },
  { value: '12', label: 'Every 12 hours' },
  { value: '24', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
] as const;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs <= 0) return 'now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute');
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour');
  const YEAR_SECS = 365 * 86_400;
  if (diffSecs >= YEAR_SECS) {
    const years = Math.floor(diffSecs / YEAR_SECS);
    const remainingDays = Math.floor((diffSecs % YEAR_SECS) / 86_400);
    const yearLabel = years === 1 ? '1 year' : `${years} years`;
    return remainingDays === 0
      ? `${yearLabel} ago`
      : `${yearLabel} ${remainingDays} day${remainingDays === 1 ? '' : 's'} ago`;
  }
  return rtf.format(-Math.floor(diffSecs / 86400), 'day');
}

interface ParsedRelease {
  release: ReleaseEntry;
  summary: string | null;
}

function minorKey(version: string): string {
  const [major, minor] = version.split('.');
  return `${major}.${minor}`;
}

/** Releases shown before "Show older versions". */
const INITIAL_VISIBLE = 8;

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Shared column grid: version | summary | date. Notes indent to the summary column. */
const ROW_GRID = 'grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-3';

function ReleaseRow({
  item,
  installed,
  open,
  onToggle,
}: {
  item: ParsedRelease;
  installed: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { release, summary } = item;
  const plainSummary = summary?.replace(/\*\*|`/g, '') ?? '';
  return (
    <li
      className={cn(
        'list-none',
        // Opened release: its own bordered card, spaced off its neighbours.
        open && 'my-2 rounded-lg border border-border bg-muted/40',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          ROW_GRID,
          'h-9 w-full rounded-lg px-2 text-left text-sm',
          !open && 'hover:bg-muted/50',
        )}
      >
        <span className="flex items-center gap-1.5 font-medium tabular-nums">
          {release.version}
          {installed && (
            <span
              title="Installed"
              className="size-1.5 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
          )}
          {installed && <span className="sr-only">Installed</span>}
        </span>
        <span
          className={cn('truncate', open ? 'text-foreground' : 'text-muted-foreground')}
          title={plainSummary}
        >
          {plainSummary}
        </span>
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {release.publishedAt ? shortDate(release.publishedAt) : ''}
        </span>
      </button>
      {open && (
        <div className="px-2 pb-3 pt-1">
          <ReleaseNotesBody notes={release.body} details hideHeadline compact />
        </div>
      )}
    </li>
  );
}

function VersionHistory() {
  const { data: releases, isLoading, isError, refetch } = useReleaseHistory();
  const [showAll, setShowAll] = useState(false);
  const [releaseToggles, setReleaseToggles] = useState<Record<string, boolean>>({});

  const parsed = useMemo<ParsedRelease[]>(
    () =>
      (releases ?? []).map((release) => {
        const p = parseReleaseNotes(release.body);
        return { release, summary: summarizeNotes(p) };
      }),
    [releases],
  );

  const truncated = !showAll && parsed.length > INITIAL_VISIBLE;
  const visible = truncated ? parsed.slice(0, INITIAL_VISIBLE) : parsed;

  const groups = useMemo(() => {
    const map = new Map<string, ParsedRelease[]>();
    for (const p of visible) {
      const key = minorKey(p.release.version);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => compareVersions(`${b}.0`, `${a}.0`));
  }, [visible]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        compact
        icon={WifiOff}
        title="Unable to load release history"
        subtitle="Check your internet connection and try again."
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (parsed.length === 0) {
    return (
      <EmptyState
        compact
        icon={PackageOpen}
        title="No release history"
        subtitle="Release history will appear here once the first version is published."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([key, items]) => (
        <section key={key} aria-label={`Version ${key}`}>
          <h4 className="mb-1 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
            {key}
            <span aria-hidden="true" className="h-px flex-1 bg-border/60" />
          </h4>
          <ul className="m-0 flex flex-col p-0">
            {items.map((item) => (
              <ReleaseRow
                key={item.release.version}
                item={item}
                installed={item.release.version === buildInfo.version}
                open={releaseToggles[item.release.version] ?? false}
                onToggle={() =>
                  setReleaseToggles((t) => ({
                    ...t,
                    [item.release.version]: !(t[item.release.version] ?? false),
                  }))
                }
              />
            ))}
          </ul>
        </section>
      ))}
      {truncated && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center text-muted-foreground"
          onClick={() => setShowAll(true)}
        >
          Show older versions ({parsed.length - INITIAL_VISIBLE})
        </Button>
      )}
    </div>
  );
}

export default function UpdatesSection() {
  const updateCheckInterval = useSettingsStore((s) => s.updateCheckInterval);
  const setUpdateCheckInterval = useSettingsStore((s) => s.setUpdateCheckInterval);
  const lastChecked = useSettingsStore((s) => s.lastChecked);
  const availableVersion = useUpdateStore((s) => s.availableVersion);

  const appendLog = useDebugLogStore((s) => s.append);
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'done'>('idle');
  const [checkResult, setCheckResult] = useState<'up-to-date' | 'available' | null>(null);

  async function handleCheckNow() {
    setCheckState('checking');
    const { setChecking, setAvailable, setError, resetToIdle } = useUpdateStore.getState();
    const setLastChecked = useSettingsStore.getState().setLastChecked;
    setChecking();
    try {
      const info = await updaterService.check();
      setLastChecked(new Date().toISOString());
      if (info) {
        setAvailable(info.version, info.body, info.date);
        setCheckResult('available');
        appendLog({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          source: 'updater',
          method: 'GET',
          url: 'tauri://updater/check',
          requestHeaders: {},
          status: 200,
          durationMs: 0,
          responseBody: `Update check: available — ${info.version}`,
        });
      } else {
        resetToIdle();
        setCheckResult('up-to-date');
        appendLog({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          source: 'updater',
          method: 'GET',
          url: 'tauri://updater/check',
          requestHeaders: {},
          status: 200,
          durationMs: 0,
          responseBody: 'Update check: up to date',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setCheckResult('up-to-date');
      appendLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'updater',
        method: 'GET',
        url: 'tauri://updater/check',
        requestHeaders: {},
        status: null,
        durationMs: 0,
        responseBody: `Update check failed: ${msg}`,
        error: msg,
      });
    }
    setCheckState('done');
    setTimeout(() => {
      setCheckState('idle');
      setCheckResult(null);
    }, 5000);
  }

  return (
    <div data-testid="section-updates" className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Updates</h2>
        <p className="text-sm">
          Current version: <span className="font-mono">{buildInfo.version}</span>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Check for updates
        </h3>
        <div className="flex flex-col gap-2">
          <label htmlFor="update-check-frequency" className="text-sm font-semibold">
            Check frequency
          </label>
          <Select
            items={FREQUENCY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={updateCheckInterval === 'manual' ? 'manual' : updateCheckInterval.toString()}
            onValueChange={(val) =>
              setUpdateCheckInterval(val === 'manual' ? 'manual' : (Number(val) as 1 | 6 | 12 | 24))
            }
          >
            <SelectTrigger id="update-check-frequency" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lastChecked !== null && (
            <p className="text-xs text-muted-foreground">
              Last checked: {relativeTime(lastChecked)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckNow}
            disabled={checkState === 'checking'}
          >
            {checkState === 'checking' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Checking...
              </>
            ) : (
              'Check Now'
            )}
          </Button>
          {checkState === 'done' && checkResult === 'up-to-date' && (
            <span className="text-sm text-green-500 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Up to date
            </span>
          )}
          {checkState === 'done' && checkResult === 'available' && availableVersion && (
            <span className="text-sm text-yellow-500">Update available ({availableVersion})</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Release History
        </h3>
        <VersionHistory />
      </div>
    </div>
  );
}
