import { Skeleton } from '@/components/ui/skeleton';

export function SprintBoardSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-3">
      <Skeleton className="h-9 w-full" />
      <div className="flex gap-2">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex-1 flex flex-col gap-2">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-20 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
