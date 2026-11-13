import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const LABEL_CLASS = 'text-sm font-medium text-muted-foreground';

/**
 * Shared look for action buttons passed via `actions`. Use with
 * `<Button variant="ghost" size="xs">` so Attach file / Bulk create / Add subtask never drift.
 */
export const SECTION_ACTION_BUTTON_CLASS = 'gap-1 text-muted-foreground hover:text-foreground';
export const SECTION_ACTION_ICON_CLASS = 'size-3';

const SEGMENTED_TRACK_CLASS =
  'inline-flex h-6 flex-none items-center gap-0.5 rounded-md bg-muted/60 p-0.5';
const SEGMENTED_ITEM_CLASS =
  'h-5 cursor-pointer rounded-[5px] px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const SEGMENTED_ACTIVE_CLASS = 'bg-background text-foreground shadow-xs';

/**
 * Quiet segmented toggle for section headers (metric switch, chart range, ...). Header
 * segmented toggles use this so they never drift. h-6 track fits the h-7 header row.
 * `value: null` means no option is active (e.g. a custom dragged range).
 */
export function SectionSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  'data-testid': testId,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: button toggle group; <fieldset> would add unwanted chrome
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={cn(SEGMENTED_TRACK_CLASS, className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(SEGMENTED_ITEM_CLASS, o.value === value && SEGMENTED_ACTIVE_CLASS)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Shared heading row for every issue-detail section (Description, Attachments, Subtasks,
 * Stories, Parent, Progress, Activity). One look everywhere: quiet muted label, optional
 * muted count, optional collapse chevron AFTER the label, actions right-aligned with gap-2
 * (ghost xs buttons styled via SECTION_ACTION_BUTTON_CLASS).
 * Fixed h-7 so the row height never depends on whether actions are present.
 *
 * Sticky by default: the header sticks to the top of the scroller and is pushed out at the
 * end of its own `<section>` (it MUST be a direct child of that section so the section is its
 * containing block). `--detail-px` / `--detail-surface` come from the scroller (IssueDetailView)
 * so the opaque background bleeds edge-to-edge over the gutters; fallbacks keep it harmless
 * elsewhere. Pass `sticky={false}` to opt out.
 */
export function SectionHeader({
  title,
  count,
  expanded,
  onToggle,
  actions,
  className,
  sticky = true,
}: {
  title: string;
  /** Shown as a muted number after the title; omit to hide (e.g. empty / unknown). */
  count?: number;
  /** With onToggle: renders the label as a collapse toggle. */
  expanded?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
  className?: string;
  /** Stick to the top of the scroller within the parent section. Default true. */
  sticky?: boolean;
}) {
  const label = (
    <>
      {title}
      {/* Space keeps textContent/accessible name "Subtasks 2"; whitespace-only flex items don't render. */}
      {count !== undefined && ' '}
      {count !== undefined && <span className="font-normal tabular-nums">{count}</span>}
    </>
  );
  return (
    <div
      className={cn(
        'flex h-7 items-center gap-2 mb-2',
        sticky &&
          'sticky top-0 z-20 bg-(--detail-surface,var(--background)) mx-[calc(var(--detail-px,0px)*-1)] px-(--detail-px,0px)',
        className,
      )}
    >
      <h3 className={cn(LABEL_CLASS, 'flex items-center gap-1.5')}>
        {onToggle ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className="flex cursor-pointer items-center gap-1.5 hover:text-foreground"
          >
            {label}
            <ChevronDown
              aria-hidden="true"
              className={cn('size-3.5 transition-transform', !expanded && '-rotate-90')}
            />
          </button>
        ) : (
          label
        )}
      </h3>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
