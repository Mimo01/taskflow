/**
 * Shared column-sort primitives for client-side sortable tables
 * (AIO cycle Defects tab, release detail Issues table).
 */

export type SortDir = 'asc' | 'desc';

/**
 * Three-state header cycle: a new column starts asc; clicking the active column
 * goes asc → desc → off (original order).
 */
export function nextSort<K extends string>(
  state: { key: K | null; dir: SortDir },
  key: K,
): { key: K | null; dir: SortDir } {
  if (state.key !== key) return { key, dir: 'asc' };
  if (state.dir === 'asc') return { key, dir: 'desc' };
  return { key: null, dir: 'asc' };
}

/**
 * Compare two sort values. Nulls always go to the bottom regardless of direction;
 * numbers are subtracted, strings use a numeric locale compare ('PROJ-9' < 'PROJ-10').
 */
export function compareNullsLast(
  a: string | number | null,
  b: string | number | null,
  dir: SortDir,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const mult = dir === 'asc' ? 1 : -1;
  const cmp =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true });
  return cmp * mult;
}
