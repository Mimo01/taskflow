/**
 * UpdatesSection — Settings section for update controls and version history.
 *
 * Contains:
 * - Current version display
 * - Update check frequency dropdown (reads/writes settings store)
 * - Check Now button with inline status feedback
 * - Last checked timestamp (relative time)
 * - VersionHistoryList: fetches GitHub Releases API and renders expandable changelogs
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  PackageOpen,
  WifiOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { buildInfo } from '@/lib/build-info';
import { updaterService } from '@/services/updater';
import { useSettingsStore } from '@/stores/settings.store';
import { useUpdateStore } from '@/stores/update.store';

const RELEASES_API_URL =
  'https://api.github.com/repos/Mimo01/taskflow-releases/releases?per_page=20';

const FREQUENCY_OPTIONS = [
  { value: '1', label: 'Every hour' },
  { value: '6', label: 'Every 6 hours' },
  { value: '12', label: 'Every 12 hours' },
  { value: '24', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
] as const;

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute');
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour');
  return rtf.format(-Math.floor(diffSecs / 86400), 'day');
}

function VersionHistoryList() {
  const { data: releases, isLoading, isError, refetch } = useQuery({
    queryKey: ['github-releases'],
    queryFn: async () => {
      const res = await fetch(RELEASES_API_URL);
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      return res.json() as Promise<GitHubRelease[]>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const [expandedTag, setExpandedTag] = useState<string | null>(null);

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

  const visibleReleases = (releases ?? []).filter((r) => !r.draft);

  if (visibleReleases.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="No release history"
        subtitle="Release history will appear here once the first version is published."
      />
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {visibleReleases.map((release) => (
        <div key={release.tag_name}>
          <button
            type="button"
            onClick={() =>
              setExpandedTag(expandedTag === release.tag_name ? null : release.tag_name)
            }
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{release.tag_name}</span>
              {release.tag_name === `v${buildInfo.version}` && (
                <Badge variant="secondary">current</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {new Date(release.published_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {expandedTag === release.tag_name ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </button>
          {expandedTag === release.tag_name && (
            <div className="pb-3 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{release.body}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function UpdatesSection() {
  const updateCheckInterval = useSettingsStore((s) => s.updateCheckInterval);
  const setUpdateCheckInterval = useSettingsStore((s) => s.setUpdateCheckInterval);
  const lastChecked = useSettingsStore((s) => s.lastChecked);
  const availableVersion = useUpdateStore((s) => s.availableVersion);

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
      } else {
        resetToIdle();
        setCheckResult('up-to-date');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCheckResult('up-to-date');
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
          <label className="text-sm font-semibold">Check frequency</label>
          <Select
            value={updateCheckInterval === 'manual' ? 'manual' : updateCheckInterval.toString()}
            onValueChange={(val) =>
              setUpdateCheckInterval(
                val === 'manual' ? 'manual' : (Number(val) as 1 | 6 | 12 | 24),
              )
            }
          >
            <SelectTrigger className="w-48">
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
            <span className="text-sm text-yellow-500">
              Update available ({availableVersion})
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Release History
        </h3>
        <VersionHistoryList />
      </div>
    </div>
  );
}
