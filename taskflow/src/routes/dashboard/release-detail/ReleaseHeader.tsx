import { CalendarDays, Package, Pencil, Pin, RefreshCw, Rocket } from 'lucide-react';
import { ReleaseIssueGraph } from '@/components/release/ReleaseIssueGraph';
import { ReleasePackageCell } from '@/components/release/ReleasePackageCell';
import { ReleaseStatusPill } from '@/components/release/ReleaseStatusPill';
import {
  DetailHeader,
  HeaderMenuItem,
  type HeaderNav,
  HeaderTool,
} from '@/components/ui/detail-header';
import { dateStamp } from '@/lib/release-agenda';
import type { DerivedPackage, ReleasePill, StatusBreakdown } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import { ReleaseDescription } from './ReleaseDescription';
import { type MetaItem, MetaLine, PropertyStrip } from './ReleaseFacts';

interface ReleaseDetailHeaderProps {
  /** Back button + trail (where the user came from); the release itself is the identity. */
  nav?: HeaderNav;
  /** Page content is scrolled: condensed one-row header. */
  compact?: boolean;
  /** Undefined while the release is loading: the header shows only the nav + identity icon. */
  name?: string;
  pill?: ReleasePill;
  releaseDate?: string;
  showPackage?: boolean;
  pkg?: DerivedPackage | null;
  pkgLoading?: boolean;
  pkgError?: boolean;
  factItems?: MetaItem[];
  jiraDescription?: string | null;
  milestoneDescription?: string | null;
  pinned?: boolean;
  onTogglePin?: () => void;
  onEdit?: () => void;
  /** Omit when the Jira base URL / project are unknown: no Open in Jira pair. */
  jiraVersionUrl?: string | null;
  /** Time string of the last issues refresh; shown in the Refresh tool's tooltip only. */
  lastRefreshed?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Release header: shared DetailHeader with meta line, description and property strip as `extra`. */
export function ReleaseDetailHeader({
  nav,
  compact,
  name,
  pill,
  releaseDate,
  showPackage = false,
  pkg = null,
  pkgLoading = false,
  pkgError = false,
  factItems = [],
  jiraDescription,
  milestoneDescription,
  pinned = false,
  onTogglePin,
  onEdit,
  jiraVersionUrl,
  lastRefreshed,
  refreshing = false,
  onRefresh,
}: ReleaseDetailHeaderProps) {
  const ready = name !== undefined && pill !== undefined;
  const items: MetaItem[] = [
    {
      id: 'date',
      node: releaseDate ? (
        <span
          data-testid="release-header-date"
          className={cn(
            'flex items-center gap-1 tabular-nums',
            pill?.tone === 'red' && 'text-red-600 dark:text-red-400',
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
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Package className="size-3.5 flex-none" aria-hidden />
          <ReleasePackageCell pkg={pkg} loading={pkgLoading} error={pkgError} />
        </span>
      ),
    });
  }
  const pinLabel = pinned ? 'Unpin release' : 'Pin release';
  const refreshTitle = lastRefreshed
    ? `Refresh release · Refreshed ${lastRefreshed}`
    : 'Refresh release';
  return (
    <DetailHeader
      data-testid="release-detail-header"
      compact={compact}
      nav={nav}
      ready={ready}
      identity={
        <>
          <Rocket className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {pill && (
            <div className="flex flex-none">
              <ReleaseStatusPill pill={pill} />
            </div>
          )}
        </>
      }
      title={name}
      titleAs="h1"
      toolbarLabel="Release actions"
      tools={
        <>
          <HeaderTool
            tier="secondary"
            icon={RefreshCw}
            spin={refreshing}
            label="Refresh"
            aria-label="Refresh release"
            title={refreshTitle}
            onClick={onRefresh}
            disabled={refreshing}
          />
          <HeaderTool
            tier="secondary"
            icon={Pin}
            iconClassName={pinned ? 'fill-current text-primary' : undefined}
            label={pinned ? 'Unpin' : 'Pin'}
            aria-label={pinLabel}
            title={pinLabel}
            onClick={onTogglePin}
          />
          <HeaderTool
            tier="primary"
            icon={Pencil}
            label="Edit"
            aria-label="Edit release"
            title="Edit release"
            onClick={onEdit}
          />
        </>
      }
      menu={({ tiny }) => (
        <>
          <HeaderMenuItem
            icon={RefreshCw}
            spin={refreshing}
            label="Refresh"
            disabled={refreshing}
            onClick={onRefresh}
          />
          <HeaderMenuItem
            icon={Pin}
            iconClassName={pinned ? 'fill-current text-primary' : undefined}
            label={pinned ? 'Unpin' : 'Pin'}
            onClick={onTogglePin}
          />
          {tiny && <HeaderMenuItem icon={Pencil} label="Edit" onClick={onEdit} />}
        </>
      )}
      primary={
        jiraVersionUrl
          ? {
              href: jiraVersionUrl,
              openLabel: 'Open in Jira',
              copyLabel: 'Copy Jira link',
              copiedLabel: 'Copied Jira link',
            }
          : undefined
      }
      extra={
        ready ? (
          <div className="mt-1 flex flex-col gap-1">
            <MetaLine items={items} />
            {/* Capped: an expanded description must not push the page scroller to zero height. */}
            <div className="max-h-[40vh] overflow-y-auto">
              <ReleaseDescription
                jiraDescription={jiraDescription}
                milestoneDescription={milestoneDescription}
              />
            </div>
            <PropertyStrip items={factItems} className="mt-1" />
          </div>
        ) : undefined
      }
    />
  );
}

/** Full-width done bar; sole owner of the "N / M done" figure (D-06). */
export function ReleaseDoneBar({
  breakdown,
  loading,
  error,
}: {
  breakdown: StatusBreakdown | undefined;
  loading: boolean;
  error: boolean;
}) {
  return (
    <div data-testid="release-done-bar">
      <ReleaseIssueGraph breakdown={breakdown} loading={loading} error={error} fullWidth />
    </div>
  );
}
