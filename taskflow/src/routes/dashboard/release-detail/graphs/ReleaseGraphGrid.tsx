import type { ReactNode } from 'react';

/** Graph slot cell; DIVIDER draws the hairline between side-by-side slots (gap-x-4 | line | pl-4). */
const SLOT_COL = 'flex min-w-0 flex-col';
const DIVIDER = 'border-l pl-4';

/**
 * Layout of the release graph section. By status sits directly above By type in
 * one cell (the two short breakdown lists share row geometry); the MR donut has
 * its own cell.
 *
 * - band (wide page): [Burnup][MRs][Status / Type][Assignee] in one row
 * - 2x2: burnup | MRs, then assignee | status/type
 * - below 640px: burnup, then MRs | status/type, then assignee; below 440 one column
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
  const lists = (
    <div data-testid="release-graph-lists" className="flex min-w-0 flex-col gap-4">
      {status}
      {type}
    </div>
  );
  if (band) {
    return (
      <div
        data-testid="release-graph-grid"
        className="mt-1 grid grid-cols-[minmax(220px,1.1fr)_auto_minmax(270px,1.1fr)_minmax(260px,1.1fr)] items-stretch gap-x-4"
      >
        {burnup}
        <div className={`${SLOT_COL} ${DIVIDER}`}>{mrs}</div>
        <div className={`${SLOT_COL} ${DIVIDER}`}>{lists}</div>
        <div className={`${SLOT_COL} ${DIVIDER}`}>{assignee}</div>
      </div>
    );
  }
  return (
    <div
      data-testid="release-graph-grid"
      className="mt-1 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-4 gap-y-4 @max-[640px]/page:grid-cols-[auto_minmax(0,1fr)] @max-[440px]/page:grid-cols-1"
    >
      <div className={`${SLOT_COL} @max-[640px]/page:col-span-full`}>{burnup}</div>
      <div className={`${SLOT_COL} ${DIVIDER} @max-[640px]/page:border-l-0 @max-[640px]/page:pl-0`}>
        {mrs}
      </div>
      <div className={`${SLOT_COL} @max-[640px]/page:order-4 @max-[640px]/page:col-span-full`}>
        {assignee}
      </div>
      <div
        className={`${SLOT_COL} ${DIVIDER} @max-[640px]/page:order-3 @max-[440px]/page:border-l-0 @max-[440px]/page:pl-0`}
      >
        {lists}
      </div>
    </div>
  );
}
