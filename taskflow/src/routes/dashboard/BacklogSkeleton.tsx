import { Skeleton } from '@/components/ui/skeleton';

export function BacklogSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-2">
      <Skeleton className="h-9 w-full" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
