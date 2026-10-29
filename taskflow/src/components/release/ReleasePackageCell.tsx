import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
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
      <Tooltip>
        <TooltipTrigger
          delay={0}
          render={<div />}
          className="relative z-10 flex min-w-0 items-center gap-1.5"
        >
          <span className={cn('truncate', !child && 'text-muted-foreground')}>
            {formatWeekLabel(week.summary)}
          </span>
          {child && <span className="truncate font-mono text-muted-foreground">{child.key}</span>}
        </TooltipTrigger>
        <TooltipContent>
          <TooltipBody title={week.summary}>
            {child ? (
              <TooltipRow label={child.key} value={child.summary} />
            ) : (
              <TooltipRow label="Package" value="No matching package" />
            )}
          </TooltipBody>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
