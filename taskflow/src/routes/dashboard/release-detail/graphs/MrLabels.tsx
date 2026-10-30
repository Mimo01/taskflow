import { Check, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';
import type { LabelCoverage } from '../releaseSummaries';

export interface MrLabelCount {
  label: { name: string; color: string; text_color: string };
  count: number;
}

const MAX_UNLABELED_ROWS = 3;
const MAX_REST_ROWS = 4;
const CHAR_W = 6.4;
const CHIP_CHROME = 14 + 4 + 12; // dot + gaps + trailing gap
const MORE_W = 30;
const UNLABELED_W = 112;
const FALLBACK_WIDTH = 400;

/** Estimated width of one "dot name count" chip. */
export function labelChipWidth(c: MrLabelCount): number {
  return CHIP_CHROME + (c.label.name.length + String(c.count).length + 1) * CHAR_W;
}

/**
 * How many label chips fit `width` after reserving room for the unlabelled
 * warning and, when some do not fit, the "+N" overflow. Chips are never dropped
 * to zero while at least one fits.
 */
export function visibleLabelCount(labels: MrLabelCount[], width: number, reserved: number): number {
  const room = width - reserved;
  let used = 0;
  let n = 0;
  for (const l of labels) {
    const w = labelChipWidth(l);
    const needsMore = n + 1 < labels.length ? MORE_W : 0;
    if (used + w + needsMore > room) break;
    used += w;
    n += 1;
  }
  return n;
}

/**
 * One compact line inside the Merge requests cell: the MR labels as quiet
 * "dot name count" chips (GitLab colour only as the dot), a muted "+N" tooltip for
 * the ones that do not fit, and an orange "N unlabelled" warning with the hover
 * list (first 3 + "+N more"). All labelled shows only a tiny check.
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
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    if (!el) return;
    setMeasured(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setMeasured(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  const missing = coverage && !coverage.allLabeled ? coverage.unlabeled.length : 0;
  if (labelSummary.length === 0 && !coverage) return null;
  const width = measured > 0 ? measured : FALLBACK_WIDTH;
  const reserved = missing > 0 ? UNLABELED_W : coverage?.allLabeled ? 16 : 0;
  const fit = visibleLabelCount(labelSummary, width, reserved);
  const shown = labelSummary.slice(0, fit);
  const rest = labelSummary.slice(fit);

  return (
    <div
      ref={setEl}
      data-testid="mr-labels"
      className={cn(
        'flex w-full min-w-0 flex-nowrap items-center justify-center gap-x-3 overflow-hidden whitespace-nowrap text-xs',
        className,
      )}
    >
      {shown.map((l) => (
        <span
          key={l.label.name}
          data-testid="mr-label-chip"
          className="inline-flex items-center gap-1"
          title={`${l.label.name}: ${l.count}`}
        >
          <span
            aria-hidden
            className="size-2 flex-none rounded-full"
            style={{ backgroundColor: l.label.color }}
          />
          <span className="text-foreground">{l.label.name}</span>
          <span className="tabular-nums text-muted-foreground">{l.count}</span>
        </span>
      ))}
      {rest.length > 0 ? (
        <Tooltip>
          <TooltipTrigger
            delay={0}
            render={<span />}
            data-testid="mr-labels-more"
            className="text-muted-foreground"
          >
            +{rest.length}
          </TooltipTrigger>
          <TooltipContent>
            <TooltipBody>
              {rest.slice(0, MAX_REST_ROWS).map((l) => (
                <TooltipRow key={l.label.name} label={l.label.name} value={l.count} />
              ))}
            </TooltipBody>
          </TooltipContent>
        </Tooltip>
      ) : null}
      {missing > 0 && coverage ? (
        <Tooltip>
          <TooltipTrigger
            delay={0}
            render={<span />}
            data-testid="mr-labels-unlabeled"
            className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400"
          >
            <TriangleAlert className="size-3 flex-none" aria-hidden />
            {missing} unlabelled
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
      ) : coverage?.allLabeled ? (
        <span
          data-testid="mr-labels-all"
          title="All MRs labelled"
          className="inline-flex text-green-600 dark:text-green-400"
        >
          <Check className="size-3 flex-none" aria-hidden />
          <span className="sr-only">All MRs labelled</span>
        </span>
      ) : null}
    </div>
  );
}
