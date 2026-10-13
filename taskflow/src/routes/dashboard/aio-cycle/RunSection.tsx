import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared surface for every block on the run detail page (description, defects, steps, sidebar). */
export const RUN_PANEL_CLASS = 'overflow-hidden rounded-xl ring-1 ring-border bg-background';

/** One heading style for all run-page sections: small caps label + optional trailing meta. */
export function SectionHeading({
  title,
  meta,
  className,
}: {
  title: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-3', className)}>
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {meta != null && (
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
          {meta}
        </div>
      )}
    </div>
  );
}

/** Heading + panel. `bare` skips the panel padding for lists that draw their own rows. */
export function RunSection({
  title,
  meta,
  children,
  testId,
  bare = false,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  testId?: string;
  bare?: boolean;
}) {
  return (
    <section className="min-w-0 space-y-2" data-testid={testId}>
      <SectionHeading title={title} meta={meta} />
      <div className={cn(RUN_PANEL_CLASS, !bare && 'px-4 py-3')}>{children}</div>
    </section>
  );
}
