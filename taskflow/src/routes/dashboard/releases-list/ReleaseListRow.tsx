import { ReleaseIssueGraph } from '@/components/release/ReleaseIssueGraph';
import { ReleasePackageCell } from '@/components/release/ReleasePackageCell';
import { ReleaseStatusPill } from '@/components/release/ReleaseStatusPill';
import type { DerivedPackage, ReleasePill, StatusBreakdown } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import type { JiraFixVersion } from '@/services/jira';
import { CELL_PADDING, RELEASE_COL } from './columns';

export function ReleaseListHeader({ showPackage }: { showPackage: boolean }) {
  return (
    <div className="flex w-full items-center border-b border-border text-xs font-semibold text-muted-foreground">
      <div className={cn(RELEASE_COL.version, CELL_PADDING)}>Version</div>
      {showPackage && <div className={cn(RELEASE_COL.package, CELL_PADDING)}>Package</div>}
      <div className={cn(RELEASE_COL.date, CELL_PADDING)}>Date</div>
      <div className={cn(RELEASE_COL.status, CELL_PADDING)}>Status</div>
      <div className={cn(RELEASE_COL.issues, CELL_PADDING)}>Issues</div>
    </div>
  );
}

export function ReleaseGroupLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex min-h-9 items-center gap-2 border-b border-border px-4 py-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

export function ReleaseListRow({
  version,
  pill,
  showPackage,
  pkg,
  pkgLoading,
  breakdown,
  graphLoading,
  graphError,
  onOpen,
}: {
  version: JiraFixVersion;
  pill: ReleasePill;
  showPackage: boolean;
  pkg: DerivedPackage | null;
  pkgLoading: boolean;
  breakdown: StatusBreakdown | undefined;
  graphLoading: boolean;
  graphError: boolean;
  onOpen: (versionId: string) => void;
}) {
  return (
    <div
      data-testid="release-row"
      className="group/row relative flex w-full items-center border-b border-border transition-colors hover:bg-muted/50"
    >
      <button
        type="button"
        aria-label={`Open release ${version.name}`}
        className="absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => onOpen(version.id)}
      />
      <div
        className={cn(
          RELEASE_COL.version,
          CELL_PADDING,
          'pointer-events-none relative truncate text-sm',
        )}
        title={version.name}
      >
        {version.name}
      </div>
      {showPackage && (
        <div className={cn(RELEASE_COL.package, CELL_PADDING)}>
          <ReleasePackageCell pkg={pkg} loading={pkgLoading} />
        </div>
      )}
      <div
        className={cn(
          RELEASE_COL.date,
          CELL_PADDING,
          'pointer-events-none relative text-xs tabular-nums text-muted-foreground',
        )}
      >
        {version.releaseDate ?? '–'}
      </div>
      <div className={cn(RELEASE_COL.status, CELL_PADDING, 'pointer-events-none relative')}>
        <ReleaseStatusPill pill={pill} />
      </div>
      <div className={cn(RELEASE_COL.issues, CELL_PADDING)}>
        <ReleaseIssueGraph
          variant="list"
          breakdown={breakdown}
          loading={graphLoading}
          error={graphError}
        />
      </div>
    </div>
  );
}
