import { Skeleton } from '@/components/ui/skeleton';

export function AioCyclesSkeleton() {
  return (
    <div className="flex flex-row h-full">
      {/* Left panel — folder tree skeleton */}
      <div className="w-64 shrink-0 border-r border-border bg-muted/10 p-2 space-y-1">
        {[
          { w: 'w-40', indent: 0 },
          { w: 'w-36', indent: 16 },
          { w: 'w-32', indent: 16 },
          { w: 'w-28', indent: 32 },
          { w: 'w-40', indent: 16 },
          { w: 'w-36', indent: 16 },
        ].map((item, i) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, no reorder
            key={i}
            className={`h-6 ${item.w}`}
            style={{ marginLeft: item.indent }}
          />
        ))}
      </div>
      {/* Right panel — cycle list skeleton */}
      <div className="flex-1 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-1.5 w-32 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
