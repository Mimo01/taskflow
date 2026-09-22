import { Skeleton } from '@/components/ui/skeleton';

export function SprintBoardSkeleton() {
  return (
    <div className="p-4 density-compact:p-2 flex flex-col gap-3 density-compact:gap-1.5">
      <Skeleton className="h-9 density-compact:h-7 w-full" />
      <div className="flex gap-2">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex-1 flex flex-col gap-2 density-compact:gap-1.5">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-20 density-compact:h-12 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
