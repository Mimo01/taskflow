'use no memo'

import { BarChart2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartWrapperProps {
  title: string;
  description?: string;
  height?: number;
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
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
  children,
}: ChartWrapperProps) {
  const renderChart = () => {
    if (isLoading) return <Skeleton className="w-full h-full rounded-md" />;
    if (error)
      return (
        <ErrorState error={error} onRetry={onRetry ?? (() => {})} viewName={title} />
      );
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
    <div className="bg-card rounded-[var(--radius)] border border-border p-6">
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>
      )}
      <div style={{ height }} className="w-full">
        {renderChart()}
      </div>
    </div>
  );
}
