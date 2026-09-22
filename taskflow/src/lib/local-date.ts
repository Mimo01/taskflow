/**
 * YYYY-MM-DD <-> Date conversions using LOCAL calendar components only.
 *
 * NEVER use `new Date('2026-05-10')` — that parses as UTC midnight, so
 * .getDate() returns the 9th for any user west of UTC.
 * NEVER use `.toISOString().slice(0,10)` on a locally-constructed Date —
 * that shifts the day for users east of UTC.
 * Same discipline as src/lib/standup-date.ts.
 */
export function parseLocalDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
