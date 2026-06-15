'use no memo';

import { BarChart2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartWrapperProps {
  title: string;
  description?: string;
  height?: number;
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  /**
   * When true, render WITHOUT the container chrome (no bg-card / rounding / ring /
   * padding) — just the title, optional description, and chart body. Use this when
   * the ChartWrapper sits INSIDE a <Card> (e.g. the SprintHealthSection donut) so it
   * never double-borders / double-pads against the surrounding Card.
   */
  bare?: boolean;
  children: ReactNode;
}

export function ChartWrapper({
  title,
  description,
  height = 240,
  isLoading,
  error,
  isEmpty,
  onRetry,
  bare = false,
  children,
}: ChartWrapperProps) {
  const renderChart = () => {
    // State precedence: error > loading > empty > success. Errors are surfaced
    // ahead of loading so a background retry after a failed fetch (TanStack
    // Query's isError + isFetching) shows the error rather than hiding it behind
    // a skeleton. Callers should pass mutually-exclusive flags where possible.
    if (error) return <ErrorState error={error} onRetry={onRetry} viewName={title} />;
    if (isLoading) return <Skeleton className="w-full h-full rounded-md" />;
    if (isEmpty)
      return (
        <EmptyState
          icon={BarChart2}
          title="No data yet"
          subtitle="Data will appear here once available."
        />
      );
    return children;
  };

  return (
    <div
      className={cn(
        'flex flex-col',
        // Default: standalone chart section — match the <Card> surface (rounded-xl + ring,
        // no border). Bare: container-less for use INSIDE a <Card> (no double border/padding).
        !bare && 'bg-card rounded-xl ring-1 ring-foreground/10 p-6',
      )}
    >
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>}
      <div style={{ height }} className="w-full">
        {renderChart()}
      </div>
    </div>
  );
}
