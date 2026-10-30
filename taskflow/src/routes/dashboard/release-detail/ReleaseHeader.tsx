import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
} from 'lucide-react';
import { ReleaseIssueGraph } from '@/components/release/ReleaseIssueGraph';
import { ReleasePackageCell } from '@/components/release/ReleasePackageCell';
import { ReleaseStatusPill } from '@/components/release/ReleaseStatusPill';
import { Button } from '@/components/ui/button';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { dateStamp } from '@/lib/release-agenda';
import type { DerivedPackage, ReleasePill, StatusBreakdown } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import type { TrailEntry } from '@/stores/breadcrumb.store';
import { ReleaseDescription } from './ReleaseDescription';
import { type MetaItem, MetaLine } from './ReleaseFacts';

interface ReleaseBreadcrumbHeaderProps {
  trail: TrailEntry[];
  versionName: string | undefined;
  onBack: () => void;
  onBreadcrumbClick: (index: number, path: string) => void;
}

export function ReleaseBreadcrumbHeader({
  trail,
  versionName,
  onBack,
  onBreadcrumbClick,
}: ReleaseBreadcrumbHeaderProps) {
  if (trail.length === 0) return null;
  return (
    <div className="px-6 py-3 border-b flex min-w-0 items-center gap-2 text-sm flex-shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex shrink-0 items-center justify-center h-7 w-7 rounded hover:bg-muted"
        aria-label="Go back"
      >
        <ArrowLeft className="size-4" />
      </button>
      {trail.map((entry, i) => (
        <span key={entry.path} className="flex min-w-0 items-center gap-2">
          {i > 0 && <span className="shrink-0 text-muted-foreground">/</span>}
          <button
            type="button"
            onClick={() => onBreadcrumbClick(i, entry.path)}
            className="min-w-0 truncate text-muted-foreground hover:text-foreground"
          >
            {entry.label}
          </button>
        </span>
      ))}
      <span className="shrink-0 text-muted-foreground">/</span>
      <span className="min-w-0 truncate font-medium" title={versionName ?? undefined}>
        {versionName ?? 'Release'}
      </span>
    </div>
  );
}

interface ReleaseDetailHeaderProps {
  name: string;
  pill: ReleasePill;
  releaseDate?: string;
  showPackage: boolean;
  pkg: DerivedPackage | null;
  pkgLoading: boolean;
  pkgError?: boolean;
  factItems: MetaItem[];
  jiraDescription?: string | null;
  milestoneDescription?: string | null;
  pinned: boolean;
  onTogglePin: () => void;
  onEdit: () => void;
  jiraVersionUrl: string | null;
  onOpenInJira: () => void;
  lastRefreshed: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

const LABEL = '@max-[640px]/page:sr-only';

/** CycleHeader-style release header: title + pill + actions, meta line, description. */
export function ReleaseDetailHeader({
  name,
  pill,
  releaseDate,
  showPackage,
  pkg,
  pkgLoading,
  pkgError = false,
  factItems,
  jiraDescription,
  milestoneDescription,
  pinned,
  onTogglePin,
  onEdit,
  jiraVersionUrl,
  onOpenInJira,
  lastRefreshed,
  refreshing,
  onRefresh,
}: ReleaseDetailHeaderProps) {
  const openInJira = (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onOpenInJira}>
      <ExternalLink className="size-3.5" />
      <span className={LABEL}>Open in Jira</span>
    </Button>
  );
  const items: MetaItem[] = [
    {
      id: 'date',
      node: releaseDate ? (
        <span
          data-testid="release-header-date"
          className={cn(
            'flex items-center gap-1 tabular-nums',
            pill.tone === 'red' && 'text-red-600 dark:text-red-400',
          )}
        >
          <CalendarDays className="size-3.5 flex-none" aria-hidden />
          {dateStamp(releaseDate).inline}
        </span>
      ) : (
        <span
          data-testid="release-header-date"
          className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
        >
          <CalendarDays className="size-3.5 flex-none" aria-hidden />
          No release date
        </span>
      ),
    },
  ];
  // ReleasePackageCell's wrapper is w-full (list cell); inside the wrapping meta
  // line that forced a line break after the date, so shrink-wrap it. Undated
  // releases have no package (UI-SPEC Undated state).
  if (showPackage && releaseDate) {
    items.push({
      id: 'package',
      node: (
        <span className="inline-flex min-w-0">
          <ReleasePackageCell pkg={pkg} loading={pkgLoading} error={pkgError} />
        </span>
      ),
    });
  }
  items.push(...factItems);
  const pinLabel = pinned ? 'Unpin release' : 'Pin release';
  return (
    <div
      data-testid="release-detail-header"
      className="flex flex-none flex-col gap-1 px-6 pt-3 pb-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 truncate text-lg font-semibold" title={name}>
            {name}
          </h1>
          <div className="flex flex-none">
            <ReleaseStatusPill pill={pill} />
          </div>
        </div>
        <div className="ml-auto flex flex-none items-center gap-1.5">
          {lastRefreshed && (
            <span className="hidden text-xs text-muted-foreground sm:inline @max-[640px]/page:hidden">
              Refreshed: {lastRefreshed}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Refresh release"
            title="Refresh release"
          >
            <RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />
          </button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            aria-label={pinLabel}
            title={pinLabel}
            onClick={onTogglePin}
          >
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            <span className={LABEL}>{pinLabel}</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onEdit}>
            <Pencil className="size-3.5" />
            <span className={LABEL}>Edit release</span>
          </Button>
          {jiraVersionUrl ? (
            <LinkContextMenu href={jiraVersionUrl}>{openInJira}</LinkContextMenu>
          ) : (
            openInJira
          )}
        </div>
      </div>
      <MetaLine items={items} />
      <ReleaseDescription
        jiraDescription={jiraDescription}
        milestoneDescription={milestoneDescription}
      />
    </div>
  );
}

/** Full-width done bar; sole owner of the "N / M done" figure (D-06). */
export function ReleaseDoneBar({
  breakdown,
  loading,
  error,
  statusNames,
}: {
  breakdown: StatusBreakdown | undefined;
  loading: boolean;
  error: boolean;
  statusNames: string | null;
}) {
  return (
    <div data-testid="release-done-bar" className="border-t px-6 pt-4">
      <ReleaseIssueGraph
        breakdown={breakdown}
        loading={loading}
        error={error}
        fullWidth
        statusNames={statusNames}
      />
    </div>
  );
}
