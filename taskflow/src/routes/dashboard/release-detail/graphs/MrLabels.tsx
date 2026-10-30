import { Check, TriangleAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';
import type { LabelCoverage } from '../releaseSummaries';

export interface MrLabelCount {
  label: { name: string; color: string; text_color: string };
  count: number;
}

/** Rows the list may use: fits beside the 4-row MR-state legend inside the band height. */
export const MAX_LABEL_ROWS = 5;
const MAX_UNLABELED_ROWS = 3;
const MAX_REST_ROWS = 4;

/**
 * Splits labels into the rows shown and the overflow. The unlabelled warning
 * (when any MR lacks a label) always keeps its row, and when labels overflow one
 * row is spent on the "+N more" entry.
 */
export function labelRowPlan(
  labels: MrLabelCount[],
  missing: number,
  maxRows = MAX_LABEL_ROWS,
): { shown: MrLabelCount[]; rest: MrLabelCount[] } {
  const avail = Math.max(1, maxRows - (missing > 0 ? 1 : 0));
  if (labels.length <= avail) return { shown: labels, rest: [] };
  return { shown: labels.slice(0, avail - 1), rest: labels.slice(avail - 1) };
}

/**
 * Second legend column of the Merge requests cell: the MR labels as a vertical
 * list styled like the state legend (text-xs, 8px dot in the GitLab colour, name,
 * right-aligned muted count). The last entry is an orange "unlabelled N" with the
 * hover list (first 3 + "+N more"); "+N more" overflow has its own tooltip. With
 * every MR labelled there is no extra entry besides a tiny check when no labels
 * exist to show.
 */
export function MrLabels({
  labelSummary,
  coverage,
  className,
}: {
  labelSummary: MrLabelCount[];
  coverage: LabelCoverage | null;
  className?: string;
}) {
  const missing = coverage && !coverage.allLabeled ? coverage.unlabeled.length : 0;
  if (labelSummary.length === 0 && missing === 0) return null;
  const { shown, rest } = labelRowPlan(labelSummary, missing);

  return (
    <div data-testid="mr-labels" className={cn('grid min-w-0 w-[7rem] gap-1.5 text-xs', className)}>
      {shown.map((l) => (
        <div
          key={l.label.name}
          data-testid="mr-label-row"
          className="flex min-w-0 items-center gap-1.5"
          title={`${l.label.name}: ${l.count}`}
        >
          <span
            aria-hidden="true"
            className="size-2 flex-none rounded-sm"
            style={{ backgroundColor: l.label.color }}
          />
          <span className="tabular-nums text-foreground">{l.count}</span>
          <span className="min-w-0 truncate text-muted-foreground">{l.label.name}</span>
        </div>
      ))}
      {rest.length > 0 ? (
        <Tooltip>
          <TooltipTrigger
            delay={0}
            render={<div />}
            data-testid="mr-labels-more"
            className="text-muted-foreground"
          >
            +{rest.length} more
          </TooltipTrigger>
          <TooltipContent>
            <TooltipBody>
              {rest.slice(0, MAX_REST_ROWS).map((l) => (
                <TooltipRow key={l.label.name} label={l.label.name} value={l.count} />
              ))}
              {rest.length > MAX_REST_ROWS && (
                <TooltipRow label={`+${rest.length - MAX_REST_ROWS}`} value="" />
              )}
            </TooltipBody>
          </TooltipContent>
        </Tooltip>
      ) : null}
      {missing > 0 && coverage ? (
        <Tooltip>
          <TooltipTrigger
            delay={0}
            render={<div />}
            data-testid="mr-labels-unlabeled"
            className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400"
          >
            <TriangleAlert className="size-2.5 flex-none" aria-hidden="true" />
            <span className="tabular-nums">{missing}</span>
            <span className="min-w-0 truncate">unlabelled</span>
          </TooltipTrigger>
          <TooltipContent>
            <div data-testid="mr-labels-unlabeled-tooltip">
              <TooltipBody>
                {coverage.unlabeled.slice(0, MAX_UNLABELED_ROWS).map((mr) => (
                  <TooltipRow key={mr.id} label={`!${mr.iid}`} value={mr.title} />
                ))}
                {missing > MAX_UNLABELED_ROWS && (
                  <TooltipRow label={`+${missing - MAX_UNLABELED_ROWS} more`} value="" />
                )}
              </TooltipBody>
            </div>
          </TooltipContent>
        </Tooltip>
      ) : coverage?.allLabeled && labelSummary.length === 0 ? (
        <span
          data-testid="mr-labels-all"
          title="All MRs labelled"
          className="inline-flex text-green-600 dark:text-green-400"
        >
          <Check className="size-3 flex-none" aria-hidden="true" />
          <span className="sr-only">All MRs labelled</span>
        </span>
      ) : null}
    </div>
  );
}
