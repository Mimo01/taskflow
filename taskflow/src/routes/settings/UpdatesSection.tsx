/**
 * UpdatesSection — Settings section for update controls and version history.
 *
 * Contains:
 * - Current version display
 * - Update check frequency dropdown (reads/writes settings store)
 * - Check Now button with inline status feedback
 * - Last checked timestamp (relative time)
 * - VersionHistory: all releases (shared useReleaseHistory query), grouped by minor version,
 *   with search, change-type chips and titles-first notes (ReleaseNotesBody)
 */

import { compareVersions } from 'compare-versions';
import {
  CheckCircle,
  ChevronRight,
  Loader2,
  PackageOpen,
  Search,
  SearchX,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
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
import { type NoteKind, parseReleaseNotes, summarizeNotes } from '@/lib/release-notes/parse';
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

const KIND_CHIPS: { value: 'all' | NoteKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'improved', label: 'Improved' },
  { value: 'fixed', label: 'Fixed' },
];

interface ParsedRelease {
  release: ReleaseEntry;
  kinds: Set<NoteKind>;
  summary: string | null;
  searchText: string;
}

function minorKey(version: string): string {
  const [major, minor] = version.split('.');
  return `${major}.${minor}`;
}

function ReleaseRow({
  item,
  installed,
  open,
  onToggle,
  kind,
  highlight,
}: {
  item: ParsedRelease;
  installed: boolean;
  open: boolean;
  onToggle: () => void;
  kind: 'all' | NoteKind;
  highlight: string;
}) {
  const { release, summary } = item;
  const plainSummary = summary?.replace(/\*\*|`/g, '') ?? '';
  return (
    <li className={cn('list-none', installed && 'rounded-md bg-muted/50')}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/50"
      >
        <span className="shrink-0 font-mono text-sm font-semibold">{release.version}</span>
        {installed && (
          <Badge variant="secondary" className="shrink-0">
            Installed
          </Badge>
        )}
        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={plainSummary}>
          {plainSummary}
        </span>
        {release.publishedAt && (
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {relativeTime(release.publishedAt)}
          </span>
        )}
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100',
            open && 'rotate-90',
          )}
        />
      </button>
      {open && (
        <div className="mb-2 ml-3 border-l-2 border-muted pb-1 pl-4">
          <ReleaseNotesBody
            notes={release.body}
            filterKinds={kind === 'all' ? undefined : [kind]}
            highlight={highlight || undefined}
          />
        </div>
      )}
    </li>
  );
}

function VersionHistory() {
  const { data: releases, isLoading, isError, refetch } = useReleaseHistory();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | NoteKind>('all');
  const [groupToggles, setGroupToggles] = useState<Record<string, boolean>>({});
  const [releaseToggles, setReleaseToggles] = useState<Record<string, boolean>>({});

  const parsed = useMemo<ParsedRelease[]>(
    () =>
      (releases ?? []).map((release) => {
        const p = parseReleaseNotes(release.body);
        return {
          release,
          kinds: new Set(p.sections.map((s) => s.kind)),
          summary: summarizeNotes(p),
          searchText: `${release.version}\n${p.raw}`.toLowerCase(),
        };
      }),
    [releases],
  );

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      parsed.filter(
        (p) => (!needle || p.searchText.includes(needle)) && (kind === 'all' || p.kinds.has(kind)),
      ),
    [parsed, needle, kind],
  );

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
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
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

  const installedKey = minorKey(buildInfo.version);
  const defaultOpenKey = groups.some(([k]) => k === installedKey)
    ? installedKey
    : (groups[0]?.[0] ?? null);
  const filtering = needle !== '' || kind !== 'all';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search updates"
            placeholder="Search updates"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <fieldset className="m-0 inline-flex rounded-lg border-0 bg-muted p-0.5">
          <legend className="sr-only">Change type</legend>
          {KIND_CHIPS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                kind === value
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          compact
          icon={SearchX}
          title="No matching updates"
          subtitle="Try a different search or change type."
        />
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map(([key, items]) => {
            const open = groupToggles[key] ?? (filtering || key === defaultOpenKey);
            return (
              <section key={key}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setGroupToggles((t) => ({ ...t, [key]: !open }))}
                  className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                >
                  <span className="text-sm font-semibold">{key}.x</span>
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? 'release' : 'releases'}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100',
                      open && 'rotate-90',
                    )}
                  />
                </button>
                {open && (
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
                        kind={kind}
                        highlight={needle}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
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
