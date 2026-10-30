import { Check, TriangleAlert } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';
import type { LabelCoverage } from '../releaseSummaries';
import { labelPillColors } from './labelColor';

export interface MrLabelCount {
  label: { name: string; color: string; text_color: string };
  count: number;
}

/** Rows the list may use (pills + "+N more" + the unlabelled line): fits the band height. */
export const MAX_LABEL_ROWS = 5;
/** At most this many pills are ever shown. */
const MAX_PILLS = 4;
const MAX_UNLABELED_ROWS = 3;
const MAX_REST_ROWS = 4;

/**
 * Splits labels into the pills shown and the overflow. The unlabelled line
 * (when any MR lacks a label) always keeps its row, and when labels overflow one
 * row is spent on the "+N more" entry.
 */
export function labelRowPlan(
  labels: MrLabelCount[],
  missing: number,
  maxRows = MAX_LABEL_ROWS,
): { shown: MrLabelCount[]; rest: MrLabelCount[] } {
  const avail = Math.max(1, Math.min(MAX_PILLS, maxRows - (missing > 0 ? 1 : 0)));
  if (labels.length <= avail) return { shown: labels, rest: [] };
  return { shown: labels.slice(0, avail - 1), rest: labels.slice(avail - 1) };
}

/**
 * GitLab-style label pill: the label colour as a soft tint, a darker (or, in dark
 * mode, lighter) shade of it for the text, a faint border, the name and the MR
 * count. The two text shades are CSS variables so the theme switch is pure CSS.
 */
function LabelPill({ l }: { l: MrLabelCount }) {
  const c = labelPillColors(l.label.color);
  return (
    <span
      data-testid="mr-label-pill"
      title={`${l.label.name}: ${l.count}`}
      className="inline-flex h-5 max-w-full min-w-0 items-center gap-1 self-start rounded-md border px-1.5 text-xs text-[color:var(--lp-l)] dark:text-[color:var(--lp-d)]"
      style={
        {
          '--lp-l': c.light,
          '--lp-d': c.dark,
          backgroundColor: `color-mix(in srgb, ${c.base} 15%, transparent)`,
          borderColor: `color-mix(in srgb, ${c.base} 30%, transparent)`,
        } as CSSProperties
      }
    >
      <span className="min-w-0 truncate">{l.label.name}</span>
      <span className="font-semibold tabular-nums">{l.count}</span>
    </span>
  );
}

/**
 * Labels column of the Merge requests cell: separated from the state legend by a
 * hairline, a vertical stack of GitLab-style pills (no dots), a muted "+N more"
 * with a tooltip for overflow, and a plain orange "unlabelled N" line with the
 * hover list (first 3 + "+N more").
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
    <div
      data-testid="mr-labels"
      className={cn('flex min-w-0 max-w-[9.5rem] flex-col gap-1 border-l pl-3 text-xs', className)}
    >
      {shown.map((l) => (
        <LabelPill key={l.label.name} l={l} />
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
            className="flex items-center gap-1 text-orange-600 dark:text-orange-400"
          >
            <TriangleAlert className="size-3 flex-none" aria-hidden="true" />
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
