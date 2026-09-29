/**
 * subtask-order — shared pure helpers for ordering subtasks.
 *
 * Primary rule: follow the parent's `fields.subtasks` sequence (Jira's own
 * subtask order). Fallback: numeric key order (X-99 before X-100), never a
 * lexical string compare. Subtasks missing from the sequence follow the listed
 * ones, sorted numerically. Status (done/open) never affects order.
 */

export type KeyLike = { key: string };
type Sequence = ReadonlyArray<KeyLike | string>;

/** Compare issue keys: project prefix first, then the numeric suffix as an integer. */
export function compareIssueKeysNumeric(a: string, b: string): number {
  const ia = a.lastIndexOf('-');
  const ib = b.lastIndexOf('-');
  if (ia > 0 && ib > 0) {
    const na = Number(a.slice(ia + 1));
    const nb = Number(b.slice(ib + 1));
    if (Number.isInteger(na) && Number.isInteger(nb)) {
      const prefix = a.slice(0, ia).localeCompare(b.slice(0, ib));
      if (prefix !== 0) return prefix;
      return na - nb;
    }
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

function indexMap(sequence?: Sequence): Map<string, number> {
  const map = new Map<string, number>();
  if (!sequence) return map;
  sequence.forEach((s, i) => {
    const k = typeof s === 'string' ? s : s.key;
    if (!map.has(k)) map.set(k, i);
  });
  return map;
}

function compareWithIndex(idx: Map<string, number>) {
  return (a: string, b: string): number => {
    const ia = idx.get(a);
    const ib = idx.get(b);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return compareIssueKeysNumeric(a, b);
  };
}

/** Order subtask keys by the parent's sequence, then numeric key. Returns a new array. */
export function orderSubtaskKeys(keys: string[], parentSequence?: Sequence): string[] {
  return [...keys].sort(compareWithIndex(indexMap(parentSequence)));
}

/** Same rule as orderSubtaskKeys applied to objects by `.key`. Returns a new array. */
export function orderSubtasks<T extends KeyLike>(subtasks: T[], parentSequence?: Sequence): T[] {
  const cmp = compareWithIndex(indexMap(parentSequence));
  return [...subtasks].sort((a, b) => cmp(a.key, b.key));
}

/**
 * Group-stable ordering over a flat list: each parent group keeps the position
 * of its first appearance; items inside a group are reordered. Items without a
 * parent key keep their slot.
 */
export function orderSubtasksWithinParents<T extends KeyLike>(
  flat: T[],
  parentSequenceFor: (parentKey: string) => Sequence | undefined,
  getParentKey: (s: T) => string | undefined,
): T[] {
  const groups = new Map<string, T[]>();
  for (const s of flat) {
    const pk = getParentKey(s);
    if (pk === undefined) continue;
    const arr = groups.get(pk) ?? [];
    arr.push(s);
    groups.set(pk, arr);
  }
  const ordered = new Map<string, T[]>();
  for (const [pk, arr] of groups) ordered.set(pk, orderSubtasks(arr, parentSequenceFor(pk)));

  // Group-stable: emit each group contiguously at its first-appearance position.
  const out: T[] = [];
  const emitted = new Set<string>();
  for (const s of flat) {
    const pk = getParentKey(s);
    if (pk === undefined) {
      out.push(s);
    } else if (!emitted.has(pk)) {
      emitted.add(pk);
      out.push(...(ordered.get(pk) ?? []));
    }
  }
  return out;
}
