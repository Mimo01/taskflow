import { Check, Tag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';
import type { LabelCoverage } from '../releaseSummaries';

const MAX_UNLABELED_ROWS = 3;

/**
 * Compact footer of the Merge requests graph: how many MRs lack a label. Orange
 * with a hover list (first 3 + "+N more") when any are missing, a muted
 * "All MRs labelled" with a check otherwise. Renders nothing without coverage
 * (no MRs), so it never shows a perpetual "Loading".
 */
export function MrLabelsLine({
  coverage,
  className,
}: {
  coverage: LabelCoverage | null;
  className?: string;
}) {
  if (!coverage) return null;
  if (coverage.allLabeled) {
    return (
      <p
        data-testid="mr-labels-line"
        className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      >
        <Check className="size-3.5 flex-none text-green-600 dark:text-green-400" aria-hidden />
        All MRs labelled
      </p>
    );
  }
  const shown = coverage.unlabeled.slice(0, MAX_UNLABELED_ROWS);
  const more = coverage.unlabeled.length - shown.length;
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={<p />}
        data-testid="mr-labels-line"
        className={cn(
          'flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400',
          className,
        )}
      >
        <Tag className="size-3.5 flex-none" aria-hidden />
        {coverage.unlabeled.length} of {coverage.total} MRs missing a label
      </TooltipTrigger>
      <TooltipContent>
        <div data-testid="mr-labels-unlabeled-tooltip">
          <TooltipBody>
            {shown.map((mr) => (
              <TooltipRow key={mr.id} label={`!${mr.iid}`} value={mr.title} />
            ))}
            {more > 0 && <TooltipRow label={`+${more} more`} value="" />}
          </TooltipBody>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
