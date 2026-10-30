import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** To-do tone for blocks and bars: stronger than the track so a single block reads on white. */
export const NEW_TONE_CLASS = 'bg-muted-foreground/30';
export const BURNUP_HEIGHT = 196;
export const BURNUP_HEIGHT_NARROW = 160;
export const DONUT_GRAPH_SIZE = 104;
export const COMPACT_DONUT_SIZE = 108;
export const ASSIGNEE_ROW_HEIGHT = 30;
export const ASSIGNEE_SKELETON_ROWS = 5;
export const WAFFLE_SKELETON_ROWS = 3;
export const GRAPH_ERROR_TEXT = "Couldn't load issues. Refresh to try again.";

export type GraphSlotState = 'loading' | 'error' | 'empty' | 'ready';

/**
 * Fixed-size slot for a release graph. Loading, empty and error states keep the
 * slot at its final height (min-height = `height`) so the page never shifts and
 * a chart never renders 0/0. No card chrome, no legend.
 */
export function GraphSlot({
  title,
  icon: Icon,
  aside,
  state,
  height,
  emptyLabel,
  errorLabel = GRAPH_ERROR_TEXT,
  skeleton,
  testId,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  aside?: ReactNode;
  state: GraphSlotState;
  height: number;
  emptyLabel?: string;
  errorLabel?: string;
  skeleton?: ReactNode;
  testId: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section data-testid={testId} className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex items-center gap-1.5">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside ? (
          <div className="ml-auto truncate text-xs text-muted-foreground">{aside}</div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        {state === 'loading' ? (
          <div data-testid={`${testId}-skeleton`}>
            {skeleton ?? <Skeleton className="w-full" style={{ height }} />}
          </div>
        ) : state === 'empty' ? (
          <div
            data-testid={`${testId}-empty`}
            className="flex flex-1 items-center justify-center text-xs text-muted-foreground"
            style={{ minHeight: height }}
          >
            {emptyLabel}
          </div>
        ) : state === 'error' ? (
          <div
            data-testid={`${testId}-error`}
            className="flex flex-1 items-center pr-0.5 text-xs italic text-muted-foreground"
            style={{ minHeight: height }}
          >
            {errorLabel}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
