import { cn } from '@/lib/utils';
import { isFilterGroupActive } from '../taskTableFilters';

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
