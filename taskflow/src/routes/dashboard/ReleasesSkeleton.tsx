import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CELL_PADDING, RELEASE_COL } from './releases-list/columns';

export function ReleasesSkeleton({ showPackage = true }: { showPackage?: boolean }) {
  return (
    <div className="@container min-w-0">
      <div className="flex w-full items-center border-b border-border">
        <div className={cn(RELEASE_COL.version, CELL_PADDING)}>
          <Skeleton className="h-3 w-16" />
        </div>
        {showPackage && (
          <div className={cn(RELEASE_COL.package, CELL_PADDING)}>
            <Skeleton className="h-3 w-12" />
          </div>
        )}
        <div className={cn(RELEASE_COL.date, CELL_PADDING)}>
          <Skeleton className="h-3 w-10" />
        </div>
        <div className={cn(RELEASE_COL.status, CELL_PADDING)}>
          <Skeleton className="h-3 w-12" />
        </div>
        <div className={cn(RELEASE_COL.issues, CELL_PADDING)}>
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          data-testid="skeleton-row"
          className="flex w-full items-center border-b border-border"
        >
          <div className={cn(RELEASE_COL.version, CELL_PADDING)}>
            <Skeleton className="h-4 w-2/3" />
          </div>
          {showPackage && (
            <div className={cn(RELEASE_COL.package, CELL_PADDING)}>
              <Skeleton className="h-3 w-28" />
            </div>
          )}
          <div className={cn(RELEASE_COL.date, CELL_PADDING)}>
            <Skeleton className="h-3 w-20" />
          </div>
          <div className={cn(RELEASE_COL.status, CELL_PADDING)}>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className={cn(RELEASE_COL.issues, CELL_PADDING)}>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
