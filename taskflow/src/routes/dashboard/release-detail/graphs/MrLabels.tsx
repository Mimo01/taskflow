import { Tag as TagIcon, TriangleAlert } from 'lucide-react';
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
        'inline-flex h-5 max-w-full min-w-0 items-stretch overflow-hidden rounded text-xs font-medium text-[color:var(--lp-l)] dark:text-[color:var(--lp-d)]',
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
      <span className="flex min-w-0 max-w-[16rem] items-center truncate px-1.5">
        {l.label.name}
      </span>
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
 * Full-width label block between the done bar and the release graphs: an
 * "N MRs without label" accent-bar callout on its own line (3px orange left bar,
 * faint tint — deliberately unlike a label pill), then a muted "Labels" caption and
 * every GitLab-style pill (never collapsed) in a wrapping row. Callout and pills
 * toggle the task table label filter when onToggleLabel is set.
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

  const hasChip = missing > 0;
  const Chip = onToggleLabel ? 'button' : 'div';

  return (
    <div
      data-testid="mr-labels"
      className={cn('flex min-w-0 flex-col items-start gap-2 text-xs', className)}
    >
      {hasChip ? (
        <Chip
          {...(onToggleLabel
            ? {
                type: 'button' as const,
                'aria-pressed': activeLabel === UNLABELED_FILTER,
                onClick: () => onToggleLabel(UNLABELED_FILTER),
                title: 'Filter tasks to MRs without a label',
              }
            : {})}
          data-testid="mr-labels-unlabeled"
          className={cn(
            'inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-r border-l-[3px] border-orange-500 bg-orange-500/8 px-2 text-left text-orange-800 dark:border-orange-400 dark:bg-orange-400/10 dark:text-orange-200',
            onToggleLabel && 'cursor-pointer hover:bg-orange-500/15',
            activeLabel === UNLABELED_FILTER &&
              'bg-orange-500/20 ring-2 ring-orange-500/60 dark:bg-orange-400/20 dark:ring-orange-400/60',
          )}
        >
          <TriangleAlert
            className="size-3 flex-none text-orange-500 dark:text-orange-400"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">
            <span className="font-semibold tabular-nums">{missing}</span>{' '}
            {missing === 1 ? 'MR' : 'MRs'} without label
          </span>
        </Chip>
      ) : null}
      {labelSummary.length > 0 ? (
        <div
          data-testid="mr-labels-pills"
          className="flex w-full min-w-0 flex-wrap items-center gap-1.5"
        >
          <TagIcon className="size-3.5 flex-none text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground @max-[440px]/page:sr-only">Labels</span>
          {labelSummary.map((l) => (
            <LabelPill
              key={l.label.name}
              l={l}
              active={activeLabel === l.label.name}
              onToggle={onToggleLabel}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
