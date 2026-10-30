import { Skeleton } from '@/components/ui/skeleton';

/** First-load skeleton shaped like the F5 agenda rail rows. */
export function ReleasesSkeleton() {
  return (
    <div className="mt-[30px] min-w-0">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          data-testid="skeleton-row"
          className="grid grid-cols-[74px_24px_minmax(0,1fr)] py-2"
        >
          <Skeleton className="mr-3 ml-auto h-3.5 w-12" />
          <div className="mx-auto size-3 rounded-full border-2 border-muted-foreground/30" />
          <div className="flex gap-4 px-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-1.5 w-[92px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
