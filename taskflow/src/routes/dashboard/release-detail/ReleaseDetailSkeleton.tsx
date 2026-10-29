import { Skeleton } from '@/components/ui/skeleton';

export function ReleaseDetailSkeleton() {
  return (
    <div data-testid="release-detail-skeleton" className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-6">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-7 w-1/3" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-full max-w-xl rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="shrink-0 space-y-3" style={{ width: 288 }}>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
    </div>
  );
}
