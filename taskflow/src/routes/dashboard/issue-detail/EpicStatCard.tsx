/**
 * Shared geometry for the four top cards of the epic progress section (quick 261002-0xf):
 * one fixed 72px three-row shape (label / value / sub) in an equal-column container-query
 * grid, identical in every tab and state. Spans only, so it is valid inside a <button>.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Put on the ancestor so the grid reacts to ITS width (peek panel vs main pane), not the viewport. */
export const STAT_CONTAINER_CLASS = '@container/epic';
/** 2x2 below a 672px container, 4 equal columns above. */
export const STAT_GRID_CLASS = 'grid grid-cols-2 gap-x-6 gap-y-4 @2xl/epic:grid-cols-4';
export const STAT_CARD_CLASS =
  'grid h-[72px] w-full min-w-0 grid-rows-[1rem_2rem_1rem] gap-1 self-start text-left';
export const STAT_CARD_FOCUS =
  'cursor-default rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
/** The one small chip text size used in the cards and band chips. */
export const CHIP_TEXT = 'text-[11px]';

export function StatCardBody({
  label,
  value,
  sub,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <>
      <span className="truncate text-xs leading-4 text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-end gap-2 leading-none">{value}</span>
      <span
        className={cn(
          'flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs leading-4 text-muted-foreground',
        )}
      >
        {sub ?? <span aria-hidden="true">{' '}</span>}
      </span>
    </>
  );
}
