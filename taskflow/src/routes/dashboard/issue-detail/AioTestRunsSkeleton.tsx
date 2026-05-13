import { Skeleton } from '@/components/ui/skeleton';

export function AioTestRunsSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" data-testid="aio-test-runs-skeleton">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-8 w-full" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
