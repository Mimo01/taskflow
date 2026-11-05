import { type ReactNode, useLayoutEffect, useState } from 'react';

/** Graph slot cell; DIVIDER draws the hairline between side-by-side slots (gap-x-4 | line | pl-4). */
const SLOT_COL = 'flex min-w-0 flex-col';
const DIVIDER = 'border-l pl-4';

/** Live border-box height of an element (0 until measured / without ResizeObserver). */
function useHeight(el: HTMLElement | null): number {
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    setH(el.getBoundingClientRect().height);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return h;
}

/**
 * Layout of the release graph section. By status sits directly above By type in
 * one cell (the two short breakdown lists share row geometry); the MR donut is
 * always last. By assignee gets the height of its tallest row neighbour so it
 * shows as many people as fit beside them.
 *
 * - band (wide page): [Burnup][Status / Type][Assignee][MRs] in one row
 * - 2x2: burnup | status/type, then assignee | MRs
 * - below 640px: burnup, status/type, then assignee | MRs; below 440 one column
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
  /** Rendered with the height to fit (undefined until measured). */
  assignee: (fitHeight: number | undefined) => ReactNode;
}) {
  const [burnupEl, setBurnupEl] = useState<HTMLDivElement | null>(null);
  const [listsEl, setListsEl] = useState<HTMLDivElement | null>(null);
  const [mrsEl, setMrsEl] = useState<HTMLDivElement | null>(null);
  const burnupH = useHeight(burnupEl);
  const listsH = useHeight(listsEl);
  const mrsH = useHeight(mrsEl);
  // Band: one row, so the tallest of burnup and the lists (the MR slot stretches
  // to centre its donut, so it is not a height source). 2x2: the MR slot beside
  // it, measured at its natural height. (Below 440 the MR slot sits under it;
  // the default cap still applies because the MR slot is short.)
  const fit = (band ? Math.max(burnupH, listsH) : mrsH) || undefined;

  const lists = (
    <div ref={setListsEl} data-testid="release-graph-lists" className="flex min-w-0 flex-col gap-4">
      {status}
      {type}
    </div>
  );
  const mrsSlot = (
    <div ref={setMrsEl} className={`flex min-w-0 flex-col ${band ? 'flex-1' : ''}`}>
      {mrs}
    </div>
  );
  if (band) {
    return (
      <div
        data-testid="release-graph-grid"
        className="mt-1 grid grid-cols-[minmax(200px,1fr)_minmax(316px,1.1fr)_minmax(250px,1.1fr)_minmax(190px,0.8fr)] items-start gap-x-4"
      >
        <div ref={setBurnupEl} className={SLOT_COL}>
          {burnup}
        </div>
        <div className={`${SLOT_COL} ${DIVIDER} self-stretch`}>{lists}</div>
        <div className={`${SLOT_COL} ${DIVIDER} self-stretch`}>{assignee(fit)}</div>
        <div className={`${SLOT_COL} ${DIVIDER} self-stretch`}>{mrsSlot}</div>
      </div>
    );
  }
  return (
    <div
      data-testid="release-graph-grid"
      className="mt-1 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-4 gap-y-4 @max-[640px]/page:grid-cols-[minmax(0,1fr)_auto] @max-[440px]/page:grid-cols-1"
    >
      <div className={`${SLOT_COL} @max-[640px]/page:col-span-full`}>{burnup}</div>
      <div
        className={`${SLOT_COL} ${DIVIDER} @max-[640px]/page:col-span-full @max-[640px]/page:border-l-0 @max-[640px]/page:pl-0`}
      >
        {lists}
      </div>
      <div className={SLOT_COL}>{assignee(fit)}</div>
      <div className={`${SLOT_COL} ${DIVIDER} @max-[440px]/page:border-l-0 @max-[440px]/page:pl-0`}>
        {mrsSlot}
      </div>
    </div>
  );
}
