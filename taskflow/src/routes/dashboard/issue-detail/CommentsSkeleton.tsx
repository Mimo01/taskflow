import { Skeleton } from '@/components/ui/skeleton';

export function CommentsSkeleton() {
  return (
    <div className="space-y-3" data-testid="comments-skeleton">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
