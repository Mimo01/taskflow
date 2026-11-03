import type React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TOOLTIP_SURFACE } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';
import { isFilterGroupActive } from '../taskTableFilters';

/**
 * Row tooltips wait before opening and sit beside the row, so a quick hover or
 * click on a toggle row is never covered by a neighbour's tooltip (261102-vuw UAT).
 */
export const ROW_TOOLTIP_DELAY = 600;
export const ROW_TOOLTIP_SIDE = 'right' as const;

/**
 * Shared behaviour of the breakdown graph rows that toggle a table filter
 * (261102-vuw). A row is interactive when `onToggle` is given and the row maps
 * to at least one filter value. Interactive rows render as a native <button>
 * (focusable, Enter/Space); only background/opacity change with state, so row
 * geometry never shifts. Colour stays reserved for status.
 */
export function rowToggleProps(
  values: string[],
  activeValues: Set<string> | undefined,
  onToggle: ((values: string[]) => void) | undefined,
) {
  const interactive = !!onToggle && values.length > 0;
  if (!interactive) {
    return { render: <div />, className: '', extra: {} as Record<string, unknown> };
  }
  const active = isFilterGroupActive(activeValues ?? new Set(), values);
  const dimmed = !active && (activeValues?.size ?? 0) > 0;
  return {
    render: <button type="button" />,
    className: cn(
      'w-full cursor-pointer text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active && 'bg-muted',
      dimmed && 'opacity-50',
    ),
    extra: { 'aria-pressed': active, onClick: () => onToggle(values) } as Record<string, unknown>,
  };
}

export interface MoreRowItem {
  key: string;
  label: string;
  value: string | number;
  /** Avatar / type icon slot, same as the graph row. */
  leading?: React.ReactNode;
  /** The row's mini bar, same as the graph row. */
  bar?: React.ReactNode;
  /** Muted italic name (Unassigned). */
  muted?: boolean;
  /** Table filter values this row stands for; empty = not toggleable. */
  filterValues: string[];
}

/**
 * The "+N more" line of a breakdown graph as a popover listing every hidden row,
 * each a toggle button like the visible rows (261102-vuw UAT). The trigger is
 * marked active when any hidden row is filtered, so the selection stays visible.
 */
export function MoreRowsPopover({
  label,
  testId,
  items,
  activeValues,
  onToggle,
  className,
}: {
  label: string;
  testId: string;
  items: MoreRowItem[];
  activeValues: Set<string> | undefined;
  onToggle: (values: string[]) => void;
  className?: string;
}) {
  const active = activeValues ?? new Set<string>();
  const hasLeading = items.some((it) => it.leading != null);
  const anyActive = items.some((it) => isFilterGroupActive(active, it.filterValues));
  return (
    <Popover>
      <PopoverTrigger
        render={<button type="button" />}
        data-testid={testId}
        className={cn(
          'relative z-10 w-full cursor-pointer rounded px-1 text-left text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          anyActive && 'bg-muted text-foreground',
          className,
        )}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent className={cn('w-72 p-1', TOOLTIP_SURFACE, 'border-0 p-1')}>
        <ul data-testid={`${testId}-list`} className="max-h-60 overflow-auto">
          {items.map((it) => {
            const pressed = isFilterGroupActive(active, it.filterValues);
            const dimmed = !pressed && active.size > 0;
            const disabled = it.filterValues.length === 0;
            return (
              <li key={it.key}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={pressed}
                  onClick={() => onToggle(it.filterValues)}
                  className={cn(
                    'grid h-7 w-full items-center gap-2 rounded px-2 text-left text-xs transition-opacity hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent',
                    hasLeading
                      ? 'grid-cols-[20px_minmax(96px,1.6fr)_minmax(36px,1fr)_30px]'
                      : 'grid-cols-[minmax(96px,1.6fr)_minmax(36px,1fr)_30px]',
                    pressed && 'bg-muted hover:bg-muted',
                    dimmed && 'opacity-50',
                  )}
                >
                  {hasLeading ? (
                    <span className="flex items-center justify-center">{it.leading}</span>
                  ) : null}
                  <span
                    className={cn('truncate', it.muted && 'pr-0.5 italic text-muted-foreground')}
                  >
                    {it.label}
                  </span>
                  <span className="flex items-center">{it.bar}</span>
                  <span className="text-right tabular-nums text-muted-foreground">{it.value}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
