import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6' : 'py-8',
      )}
    >
      <Icon className={cn('text-muted-foreground', compact ? 'size-8 mb-3' : 'size-12 mb-4')} />
      <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>
        {title}
      </p>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
