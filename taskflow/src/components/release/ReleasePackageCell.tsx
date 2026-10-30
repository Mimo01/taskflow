import { Skeleton } from '@/components/ui/skeleton';
import { formatWeekLabel } from '@/lib/deployment-package';
import type { DerivedPackage } from '@/lib/release-list';
import { cn } from '@/lib/utils';

const WRAPPER = 'flex w-full min-w-0 items-center gap-1.5 text-xs';
export const PACKAGE_ERROR_TEXT = "Couldn't load the RM deployment package";
/** Raised above a row's overlay button so the failure tooltip can show. */
const ERROR_HOVER = 'pointer-events-auto relative z-10 cursor-help';

/**
 * RM deployment package for a release: child, week-only, none, or loading.
 * Without a child, `loading` means the child may still arrive (children or the
 * project lookup are in flight), so it skeletons instead of the week-only state.
 */
export function ReleasePackageCell({
  pkg,
  loading,
  error = false,
}: {
  pkg: DerivedPackage | null;
  loading: boolean;
  /** An RM lookup failed: a missing child or week is unknown, not absent. */
  error?: boolean;
}) {
  if (loading && !pkg?.child) {
    return (
      <div data-testid="row-deployment-package" className={WRAPPER}>
        <Skeleton data-testid="package-skeleton" className="h-3 w-28" />
      </div>
    );
  }
  if (!pkg) {
    return (
      <div data-testid="row-deployment-package" className={WRAPPER}>
        <span
          className={cn('text-muted-foreground', error && ERROR_HOVER)}
          title={error ? PACKAGE_ERROR_TEXT : undefined}
        >
          –
        </span>
      </div>
    );
  }

  const { week, child } = pkg;
  return (
    <div data-testid="row-deployment-package" className={WRAPPER}>
      <span
        className={cn(
          'truncate',
          !child && 'text-muted-foreground',
          !child && error && ERROR_HOVER,
        )}
        title={!child && error ? PACKAGE_ERROR_TEXT : undefined}
      >
        {formatWeekLabel(week.summary)}
      </span>
      {child && <span className="truncate font-mono text-muted-foreground">{child.key}</span>}
    </div>
  );
}
