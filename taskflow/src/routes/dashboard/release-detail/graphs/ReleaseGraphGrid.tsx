import type { ReactNode } from 'react';

/** Graph slot cell; DIVIDER draws the hairline between side-by-side slots (gap-x-4 | line | pl-4). */
const SLOT_COL = 'flex min-w-0 flex-col';
const DIVIDER = 'border-l pl-4';

/**
 * Layout of the release graph section. By status (three short rows) and the MR
 * donut always share one cell side by side; only that cell's neighbours move.
 *
 * - band (wide page): [Burnup][Status | MRs][Type][Assignee] in one row
 * - 2x2: burnup | status+MRs, then assignee | type
 * - below 640px: one column, burnup, status+MRs, type, assignee
 */
export function ReleaseGraphGrid({
  band,
  burnup,
  status,
  mrs,
  type,
  assignee,
}: {
  band: boolean;
  burnup: ReactNode;
  status: ReactNode;
  mrs: ReactNode;
  type: ReactNode;
  assignee: ReactNode;
}) {
  const pair = (
    <div
      data-testid="release-graph-donuts"
      className={`grid min-w-0 items-stretch gap-x-4 ${band ? 'grid-cols-[168px_auto]' : 'grid-cols-[minmax(150px,1fr)_auto]'}`}
    >
      <div className={SLOT_COL}>{status}</div>
      <div className={`${SLOT_COL} ${DIVIDER}`}>{mrs}</div>
    </div>
  );
  if (band) {
    return (
      <div
        data-testid="release-graph-grid"
        className="mt-1 grid grid-cols-[minmax(190px,1fr)_auto_minmax(290px,1.15fr)_minmax(240px,1fr)] items-stretch gap-x-4"
      >
        {burnup}
        <div className={`${SLOT_COL} ${DIVIDER}`}>{pair}</div>
        <div className={`${SLOT_COL} ${DIVIDER}`}>{type}</div>
        <div className={`${SLOT_COL} ${DIVIDER}`}>{assignee}</div>
      </div>
    );
  }
  return (
    <div
      data-testid="release-graph-grid"
      className="mt-1 grid grid-cols-[minmax(0,1.2fr)_minmax(310px,1fr)] gap-x-4 gap-y-4 @max-[640px]/page:grid-cols-1"
    >
      {burnup}
      <div className={`${SLOT_COL} ${DIVIDER} @max-[640px]/page:border-l-0 @max-[640px]/page:pl-0`}>
        {pair}
      </div>
      <div className={`${SLOT_COL} @max-[640px]/page:order-4`}>{assignee}</div>
      <div
        className={`${SLOT_COL} ${DIVIDER} @max-[640px]/page:order-3 @max-[640px]/page:border-l-0 @max-[640px]/page:pl-0`}
      >
        {type}
      </div>
    </div>
  );
}
