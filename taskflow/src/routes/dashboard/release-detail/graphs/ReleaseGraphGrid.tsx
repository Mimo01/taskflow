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

/** Compact row pitch of By type (12px squares + 8px padding) and By assignee. */
const TYPE_ROW_H = 20;
const ASSIGNEE_ROW_H = 24;
const LIST_CAP = 5;

/**
 * Which list By status stacks on top of: the shorter of By type and By
 * assignee, so the two middle columns end at a similar height. Big releases
 * (many people) get status over type; small ones (1-3 people) status over
 * assignees.
 */
export function statusPairing(typeRows: number, assigneeRows: number): 'type' | 'assignee' {
  const typeH = Math.min(typeRows, LIST_CAP) * TYPE_ROW_H;
  const assigneeH = Math.min(assigneeRows, LIST_CAP) * ASSIGNEE_ROW_H;
  return assigneeH < typeH ? 'assignee' : 'type';
}

/**
 * Layout of the release graph section. By status stacks above the shorter of
 * By type / By assignee (statusPairing); the MR donut is always last. A lone
 * By assignee gets the height of its tallest row neighbour so it shows as many
 * people as fit beside them.
 *
 * - band (wide page): [Burnup][Type group][Assignee group][MRs] in one row
 * - 2x2: burnup | type group, then assignee group | MRs
 * - below 640px: burnup, type group, then assignee group | MRs; below 440 one column
 */
export function ReleaseGraphGrid({
  band,
  burnup,
  status,
  mrs,
  type,
  assignee,
  statusWith: statusWithProp = 'type',
}: {
  band: boolean;
  burnup: ReactNode;
  status: ReactNode;
  mrs: ReactNode;
  type: ReactNode;
  /** Rendered with the height to fit (undefined = use the default cap). */
  assignee: (fitHeight: number | undefined) => ReactNode;
  /** The list By status stacks on in the band (see statusPairing). 2x2 always stacks it on
   * By type: there the type group sits beside the tall burnup, the assignee group beside
   * the short MR slot. */
  statusWith?: 'type' | 'assignee';
}) {
  const statusWith = band ? statusWithProp : 'type';
  const [burnupEl, setBurnupEl] = useState<HTMLDivElement | null>(null);
  const [typeGroupEl, setTypeGroupEl] = useState<HTMLDivElement | null>(null);
  const [mrsEl, setMrsEl] = useState<HTMLDivElement | null>(null);
  const burnupH = useHeight(burnupEl);
  const typeGroupH = useHeight(typeGroupEl);
  const mrsH = useHeight(mrsEl);
  // Only a lone By assignee fits a neighbour. Band: one row, so the tallest of
  // burnup and the type group (the MR slot stretches to centre its donut, so it
  // is not a height source). 2x2: the MR slot beside it, at its natural height.
  const fit =
    statusWith === 'type' ? (band ? Math.max(burnupH, typeGroupH) : mrsH) || undefined : undefined;

  const typeGroup = (
    <div
      ref={setTypeGroupEl}
      data-testid="release-graph-type-group"
      className="flex min-w-0 flex-col gap-4"
    >
      {statusWith === 'type' ? status : null}
      {type}
    </div>
  );
  const assigneeGroup = (
    <div data-testid="release-graph-assignee-group" className="flex min-w-0 flex-col gap-4">
      {statusWith === 'assignee' ? status : null}
      {assignee(fit)}
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
        className="mt-1 grid grid-cols-[minmax(200px,1fr)_minmax(300px,1.1fr)_minmax(270px,1.1fr)_minmax(190px,0.8fr)] items-start gap-x-4"
      >
        <div ref={setBurnupEl} className={SLOT_COL}>
          {burnup}
        </div>
        <div className={`${SLOT_COL} ${DIVIDER} self-stretch`}>{typeGroup}</div>
        <div className={`${SLOT_COL} ${DIVIDER} self-stretch`}>{assigneeGroup}</div>
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
        {typeGroup}
      </div>
      <div className={SLOT_COL}>{assigneeGroup}</div>
      <div className={`${SLOT_COL} ${DIVIDER} @max-[440px]/page:border-l-0 @max-[440px]/page:pl-0`}>
        {mrsSlot}
      </div>
    </div>
  );
}
