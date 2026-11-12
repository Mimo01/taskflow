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

/**
 * Shared heading row for every issue-detail section (Description, Attachments, Subtasks,
 * Stories, Parent, Progress, Activity). One look everywhere: quiet muted label, optional
 * muted count, optional collapse chevron AFTER the label, actions right-aligned with gap-2
 * (ghost xs buttons styled via SECTION_ACTION_BUTTON_CLASS).
 * Fixed h-7 so the row height never depends on whether actions are present.
 */
export function SectionHeader({
  title,
  count,
  expanded,
  onToggle,
  actions,
  className,
}: {
  title: string;
  /** Shown as a muted number after the title; omit to hide (e.g. empty / unknown). */
  count?: number;
  /** With onToggle: renders the label as a collapse toggle. */
  expanded?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
  className?: string;
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
    <div className={cn('flex h-7 items-center gap-2 mb-2', className)}>
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
