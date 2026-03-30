import { Skeleton } from '@/components/ui/skeleton';

export function SprintProgressSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-8 w-full" data-testid="skeleton-row" />
      ))}
    </div>
  );
}
