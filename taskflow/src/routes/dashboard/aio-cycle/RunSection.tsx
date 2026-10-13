import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Section heading in the app's detail-page convention (IssueDetailContent / release detail):
 * `text-sm font-medium text-muted-foreground`, optional "(n)" count, optional trailing meta.
 */
export function SectionHeading({
  title,
  count,
  meta,
  className,
}: {
  title: string;
  count?: number;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex min-w-0 items-center justify-between gap-3', className)}>
      <h3 className="text-sm font-medium text-muted-foreground">
        {title}
        {count != null ? ` (${count})` : ''}
      </h3>
      {meta != null && (
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
          {meta}
        </div>
      )}
    </div>
  );
}

/** Plain section — heading + content, no surrounding panel (matches the issue detail page). */
export function RunSection({
  title,
  count,
  meta,
  children,
  testId,
}: {
  title: string;
  count?: number;
  meta?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="min-w-0" data-testid={testId}>
      <SectionHeading title={title} count={count} meta={meta} />
      {children}
    </section>
  );
}
