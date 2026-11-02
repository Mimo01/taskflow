import { Check, TriangleAlert } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { LabelCoverage } from '../releaseSummaries';
import { labelPillColors, TINT_ALPHA } from './labelColor';

export interface MrLabelCount {
  label: { name: string; color: string; text_color: string };
  count: number;
}

/** Sentinel passed to onToggleLabel / activeLabel for the "no label" filter. */
export const UNLABELED_FILTER = '__unlabeled__';

/**
 * GitLab-style label pill on the app's status-pill geometry (rounded, no border,
 * font-medium): the label colour as a soft tint, a darker (or, in dark mode,
 * lighter) shade of it for the text, the name and the MR count. The count sits in
 * its own segment behind a hairline in the label colour, the way GitLab splits
 * scoped labels. The two text shades are CSS variables so the theme switch is pure CSS.
 */
function LabelPill({
  l,
  active,
  onToggle,
}: {
  l: MrLabelCount;
  active?: boolean;
  onToggle?: (name: string) => void;
}) {
  const c = labelPillColors(l.label.color);
  const interactive = !!onToggle;
  const Tag = interactive ? 'button' : 'span';
  return (
    <Tag
      data-testid="mr-label-pill"
      title={interactive ? `Filter tasks by ${l.label.name}` : `${l.label.name}: ${l.count}`}
      {...(interactive
        ? {
            type: 'button' as const,
            'aria-pressed': !!active,
            onClick: () => onToggle(l.label.name),
          }
        : {})}
      className={cn(
        'inline-flex h-5 max-w-full min-w-0 items-stretch self-start justify-self-start overflow-hidden rounded text-xs font-medium text-[color:var(--lp-l)] dark:text-[color:var(--lp-d)]',
        interactive && 'cursor-pointer ring-offset-0 hover:brightness-95',
        active && 'ring-2 ring-[color:var(--lp-l)] dark:ring-[color:var(--lp-d)]',
      )}
      style={
        {
          '--lp-l': c.light,
          '--lp-d': c.dark,
          backgroundColor: `color-mix(in srgb, ${c.base} ${TINT_ALPHA * 100}%, transparent)`,
        } as CSSProperties
      }
    >
      <span className="flex min-w-0 items-center truncate px-1.5">{l.label.name}</span>
      <span
        data-testid="mr-label-count"
        className="flex items-center border-l px-1.5 tabular-nums opacity-80"
        style={{ borderColor: `color-mix(in srgb, ${c.base} 35%, transparent)` }}
      >
        {l.count}
      </span>
    </Tag>
  );
}

/**
 * Max pill rows before extra pills flow into another column: 5 rows of h-5 pills
 * plus gap-1 is 116px, which fits beside the 120px donut.
 */
const MAX_LABEL_ROWS = 5;

/**
 * Labels block of the Merge requests cell: separated from the state legend by a
 * hairline, a column-major grid at most 5 rows tall (extra pills flow into more
 * columns, never collapsed) of every GitLab-style pill, ending with the dashed
 * orange "No label N" pill.
 */
export function MrLabels({
  labelSummary,
  coverage,
  className,
  activeLabel = null,
  onToggleLabel,
}: {
  labelSummary: MrLabelCount[];
  coverage: LabelCoverage | null;
  className?: string;
  /** Label currently filtering the task table; its pill renders pressed. */
  activeLabel?: string | null;
  /** When set, pills are toggle buttons that filter the task table by label. */
  onToggleLabel?: (name: string) => void;
}) {
  const missing = coverage && !coverage.allLabeled ? coverage.unlabeled.length : 0;
  if (labelSummary.length === 0 && missing === 0) return null;

  const itemCount = labelSummary.length + (missing > 0 ? 1 : 0);
  const rows = Math.max(1, Math.min(itemCount, MAX_LABEL_ROWS));
  const Pill = onToggleLabel ? 'button' : 'div';

  return (
    <div
      data-testid="mr-labels"
      className={cn(
        'grid min-w-0 grid-flow-col content-start justify-start gap-1 gap-x-1.5 border-l pl-3 text-xs',
        className,
      )}
      style={{
        gridTemplateRows: `repeat(${rows}, auto)`,
        gridAutoColumns: 'minmax(0, 9.5rem)',
      }}
    >
      {labelSummary.map((l) => (
        <LabelPill
          key={l.label.name}
          l={l}
          active={activeLabel === l.label.name}
          onToggle={onToggleLabel}
        />
      ))}
      {missing > 0 && coverage ? (
        <Pill
          {...(onToggleLabel
            ? {
                type: 'button' as const,
                'aria-pressed': activeLabel === UNLABELED_FILTER,
                onClick: () => onToggleLabel(UNLABELED_FILTER),
              }
            : {})}
          data-testid="mr-labels-unlabeled"
          className={cn(
            'inline-flex h-5 max-w-full min-w-0 items-center gap-1 self-start justify-self-start overflow-hidden rounded border border-dashed border-orange-500/60 bg-transparent px-1.5 text-xs font-medium text-orange-700 dark:text-orange-300',
            onToggleLabel && 'cursor-pointer hover:bg-orange-500/10',
            activeLabel === UNLABELED_FILTER &&
              'border-solid border-orange-600 bg-orange-500/15 dark:border-orange-400',
          )}
        >
          <TriangleAlert className="size-3 flex-none" aria-hidden="true" />
          <span className="min-w-0 truncate">No label</span>
          <span className="tabular-nums">{missing}</span>
        </Pill>
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
