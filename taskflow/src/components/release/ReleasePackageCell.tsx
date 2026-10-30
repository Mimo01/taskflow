import { Skeleton } from '@/components/ui/skeleton';
import { formatWeekLabel } from '@/lib/deployment-package';
import type { DerivedPackage } from '@/lib/release-list';
import { cn } from '@/lib/utils';

const WRAPPER = 'flex w-full min-w-0 items-center gap-1.5 text-xs';

/** RM deployment package for a release: child, week-only, none, or loading. */
export function ReleasePackageCell({
  pkg,
  loading,
}: {
  pkg: DerivedPackage | null;
  loading: boolean;
}) {
  if (loading && !pkg) {
    return (
      <div data-testid="row-deployment-package" className={WRAPPER}>
        <Skeleton data-testid="package-skeleton" className="h-3 w-28" />
      </div>
    );
  }
  if (!pkg) {
    return (
      <div data-testid="row-deployment-package" className={WRAPPER}>
        <span className="text-muted-foreground">–</span>
      </div>
    );
  }

  const { week, child } = pkg;
  return (
    <div data-testid="row-deployment-package" className={WRAPPER}>
      <span className={cn('truncate', !child && 'text-muted-foreground')}>
        {formatWeekLabel(week.summary)}
      </span>
      {child && <span className="truncate font-mono text-muted-foreground">{child.key}</span>}
    </div>
  );
}
