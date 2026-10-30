import { ArrowLeft, ExternalLink, Pencil, Pin, PinOff } from 'lucide-react';
import { ReleaseIssueGraph } from '@/components/release/ReleaseIssueGraph';
import { ReleasePackageCell } from '@/components/release/ReleasePackageCell';
import { ReleaseStatusPill } from '@/components/release/ReleaseStatusPill';
import { Button } from '@/components/ui/button';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { dateStamp } from '@/lib/release-agenda';
import type { DerivedPackage, ReleasePill, StatusBreakdown } from '@/lib/release-list';
import type { TrailEntry } from '@/stores/breadcrumb.store';

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
  breakdown: StatusBreakdown | undefined;
  breakdownLoading: boolean;
  breakdownError: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onEdit: () => void;
  jiraVersionUrl: string | null;
  onOpenInJira: () => void;
}

/** Detail header that echoes the list row; sole owner of the done figure (D-14). */
export function ReleaseDetailHeader({
  name,
  pill,
  releaseDate,
  showPackage,
  pkg,
  pkgLoading,
  pkgError = false,
  breakdown,
  breakdownLoading,
  breakdownError,
  pinned,
  onTogglePin,
  onEdit,
  jiraVersionUrl,
  onOpenInJira,
}: ReleaseDetailHeaderProps) {
  const openInJira = (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onOpenInJira}>
      <ExternalLink className="size-3.5" />
      Open in Jira
    </Button>
  );
  return (
    <div data-testid="release-detail-header" className="@container mb-8 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-xl font-semibold leading-tight truncate" title={name}>
            {name}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <ReleaseStatusPill pill={pill} />
            {releaseDate && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {dateStamp(releaseDate).inline}
              </span>
            )}
            {showPackage && (
              <div className="w-44">
                <ReleasePackageCell pkg={pkg} loading={pkgLoading} error={pkgError} />
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            aria-label={pinned ? 'Unpin release' : 'Pin release'}
            title={pinned ? 'Unpin release' : 'Pin release'}
            onClick={onTogglePin}
          >
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {pinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          {jiraVersionUrl ? (
            <LinkContextMenu href={jiraVersionUrl}>{openInJira}</LinkContextMenu>
          ) : (
            openInJira
          )}
        </div>
      </div>
      <ReleaseIssueGraph
        variant="detail"
        breakdown={breakdown}
        loading={breakdownLoading}
        error={breakdownError}
      />
    </div>
  );
}
