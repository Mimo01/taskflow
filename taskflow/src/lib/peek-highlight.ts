/**
 * Shared classes marking the row/card whose issue is open in the peek sidebar.
 * Background + box-shadow/ring only (no border/padding) so there is no layout shift.
 */

/** List rows: subtle primary tint + 3px inset leading-edge bar. */
export const PEEKED_ROW_CLASS =
  'bg-primary/10 hover:bg-primary/15 shadow-[inset_3px_0_0_var(--color-primary)]';

/** TaskCard: tint + ring (its 3px type stripe owns the leading edge). */
export const PEEKED_CARD_CLASS = 'bg-primary/10 hover:bg-primary/15 ring-2 ring-primary/70';
