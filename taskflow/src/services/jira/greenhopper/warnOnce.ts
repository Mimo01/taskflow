/**
 * Shared warn-once guard for the GreenHopper folder.
 *
 * Extracted from `entityMaps.ts` (Phase 71 D-07) so the entity-map resolvers
 * (statuses/priorities/types/epics) and the Phase 72 transitions adapter
 * (workflow miss + status-id miss) share a single module-level `seenMissing`
 * Set. Two different `(kind, id)` callers therefore collapse to one warn per
 * unique key per session, matching RESEARCH §Pitfall 4.
 *
 * Warn message format is preserved verbatim from the original entityMaps
 * implementation so no existing console output changes:
 *   `[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`
 */

// Module-level guard. Keys are `${kind}:${id}`.
const seenMissing = new Set<string>();

/**
 * Emit at most one `console.warn` per unique `(kind, id)` pair.
 *
 * Subsequent calls with the same pair are silent. Different kinds or different
 * ids produce additional warnings.
 */
export function warnOnce(kind: string, id: string): void {
  const key = `${kind}:${id}`;
  if (seenMissing.has(key)) return;
  seenMissing.add(key);
  console.warn(`[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`);
}

/**
 * Test-only: clear the warnOnce guard between cases so each `it()` can
 * independently assert "two misses, one warn" behavior.
 *
 * Internal — not part of any public adapter surface.
 */
export function __resetWarnOnce(): void {
  seenMissing.clear();
}
