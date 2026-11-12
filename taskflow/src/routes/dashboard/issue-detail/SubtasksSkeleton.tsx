import { Skeleton } from '@/components/ui/skeleton';

export function SubtasksSkeleton() {
  return (
    <div className="space-y-2" data-testid="subtasks-skeleton">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
