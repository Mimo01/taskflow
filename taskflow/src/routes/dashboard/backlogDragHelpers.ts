/**
 * Pure helpers for the Backlog drag-to-rank multi-container resolution.
 *
 * These are extracted from BacklogPage's drag handlers so the cross-section
 * container resolution can be unit-tested without simulating a real dnd-kit
 * pointer drag (which jsdom cannot do). The dnd-kit multi-container recipe
 * needs `over` to resolve to a section even when the pointer is over a section
 * header, gap, or empty section — not only when it is directly over a row.
 *
 * Section ids are the stable strings used by both `SortableContext id` and
 * `useDroppable id`: `sprint-<id>` for sprint sections, `backlog` for the
 * unassigned bucket.
 */

/** Minimal shape of a dnd-kit draggable/droppable node's `data.current`. */
export interface SortableData {
  sortable?: { containerId?: string };
}

/** Set of all valid section ids currently rendered (sprint-* + backlog). */
export type SectionIdSet = ReadonlySet<string>;

/**
 * Resolve the source section id of the dragged row.
 *
 * The active row is always a sortable item, so its container is always the
 * `sortable.containerId`.
 */
export function resolveSourceContainer(activeData: SortableData | undefined): string | null {
  return activeData?.sortable?.containerId ?? null;
}

/**
 * Resolve the target section id of a drop.
 *
 * Resolution order (dnd-kit multi-container recipe):
 *   1. If `over` is a row, use that row's `sortable.containerId`.
 *   2. Otherwise `over.id` is itself a section droppable id — use it directly,
 *      but only if it is a known section id (so we never resolve to a stray
 *      droppable). This is what makes dropping on a section header, gap, or
 *      empty section resolve to the section.
 *
 * Returns null when nothing resolvable is under the pointer.
 */
export function resolveTargetContainer(
  overId: string | null,
  overData: SortableData | undefined,
  sectionIds: SectionIdSet,
): string | null {
  const rowContainer = overData?.sortable?.containerId;
  if (rowContainer) return rowContainer;
  if (overId && sectionIds.has(overId)) return overId;
  return null;
}

/**
 * Compute the insertion index of the dragged item within the target section.
 *
 * - When `over` is a row in the target section, insert at that row's index.
 * - When `over` is the section droppable itself (header/gap/empty section),
 *   append to the end — except an empty section, where index 0 is the only
 *   valid insert point (and also equals `targetKeys.length === 0`).
 */
export function computeInsertIndex(overId: string | null, targetKeys: readonly string[]): number {
  const idx = overId != null ? targetKeys.indexOf(overId) : -1;
  return idx === -1 ? targetKeys.length : idx;
}

/**
 * Build the new ordered key list for the target section after inserting
 * `activeKey` at `insertIndex`. `activeKey` is first removed if it already
 * exists in the list (defensive — cross-section it should not).
 */
export function buildTargetOrder(
  targetKeys: readonly string[],
  activeKey: string,
  insertIndex: number,
): string[] {
  const without = targetKeys.filter((k) => k !== activeKey);
  const clamped = Math.max(0, Math.min(insertIndex, without.length));
  return [...without.slice(0, clamped), activeKey, ...without.slice(clamped)];
}

/**
 * The over-target state tracked during a drag, used to drive the SUBTLE
 * cross-section highlight ring (`overSectionId`). The ghost placeholder row
 * (live-reordered into its drop slot) is now the PRIMARY drop cue, so the old
 * per-row insertion line state (`overRowKey` + `dropEdge`) is gone.
 */
export interface OverState {
  overSectionId: string | null;
}

/**
 * True when two over-states are identical. Used by `handleDragOver` to skip
 * setState calls on steady-state pointer movement (same section), which would
 * otherwise re-render the whole BacklogPage every pointer frame and interrupt
 * dnd-kit's transform animation (jank). Only a real section change should
 * trigger a re-render of the highlight ring.
 */
export function overStateEquals(a: OverState, b: OverState): boolean {
  return a.overSectionId === b.overSectionId;
}

/**
 * Compute the next live-reorder result for an INTRA-section drag.
 *
 * Given a section's current key order, the dragged key, and the key currently
 * under the pointer (the `over` row), returns the new order with the dragged
 * key moved to the over-row's index (arrayMove semantics). Returns the SAME
 * array reference when nothing changes (active === over, or either key is
 * missing) so the caller can cheaply gate the setState and avoid per-frame
 * re-render jank.
 */
export function computeLiveReorder(
  keys: readonly string[],
  activeKey: string,
  overKey: string,
): string[] {
  if (activeKey === overKey) return keys as string[];
  const oldIndex = keys.indexOf(activeKey);
  const newIndex = keys.indexOf(overKey);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return keys as string[];
  const next = keys.slice();
  next.splice(oldIndex, 1);
  next.splice(newIndex, 0, activeKey);
  return next;
}

/**
 * Sort a list of items by an explicit key order (a `localOrder` override),
 * pushing any item whose key is absent from `orderedKeys` to the end in a
 * deterministic, stable way.
 *
 * WR-02 (regression guard): the naive comparator
 * `(ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)` returns
 * `Infinity - Infinity = NaN` when BOTH keys are absent from `orderedKeys`
 * (reachable with a stale override + an active filter, or new issues fetched
 * mid-override). A `NaN` comparator is not a total order — the result is an
 * implementation-defined, unstable sort. We rank unknown keys with a large
 * FINITE fallback and break ties on the key string so the order is total and
 * deterministic. Returns a new array; does not mutate the input.
 */
export function sortByKeyOrder<T extends { key: string }>(
  items: readonly T[],
  orderedKeys: readonly string[],
): T[] {
  const rank = (k: string): number => {
    const i = orderedKeys.indexOf(k);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...items].sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

/** True when two key arrays are element-wise identical (live-reorder gate). */
export function keyOrderEquals(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Full cross-section drop resolution used by handleDragEnd. Returns null when
 * the drop is not a valid cross-section move (no target, or target === source).
 */
export interface CrossSectionResolution {
  sourceContainer: string;
  targetContainer: string;
  insertIndex: number;
  newTargetOrder: string[];
}

/**
 * Optimistic cross-section cache move (Defect-B).
 *
 * Section membership in the Backlog is derived from the SERVER `gh-backlog`
 * cache's `sprints[].issuesIds[]` (the issueId → sprintId reverse index), NOT
 * from `localOrder` — which only re-sorts keys within a section's existing
 * server membership. To make a cross-section move render in the target section
 * IMMEDIATELY (no post-success jump), the issue's numeric id must be moved
 * between the cached `sprints[].issuesIds[]` arrays before the network awaits.
 *
 * Given the current `sprints` membership arrays, the moved issue's numeric id,
 * and the target section id (`sprint-<id>` or `backlog`), returns the new
 * `sprints` membership arrays:
 *   - `backlog`  → drop the id from every sprint (demote to the backlog bucket).
 *   - `sprint-N` → add the id to sprint N (if absent) and remove it from all
 *                  other sprints.
 *
 * Pure and immutable — does not mutate the input. The full
 * GhBacklogResponse-shaped `setQueryData` writer in BacklogPage maps over this
 * result; this helper isolates the membership math so it can be unit-tested
 * without a real react-query cache or a dnd-kit pointer drag.
 */
export interface SprintMembership {
  id: number;
  issuesIds: number[];
}

export function moveIssueAcrossSections<S extends SprintMembership>(
  sprints: readonly S[],
  issueNumericId: number,
  toSectionId: string,
): S[] {
  if (toSectionId === 'backlog') {
    return sprints.map((s) => ({
      ...s,
      issuesIds: s.issuesIds.filter((id) => id !== issueNumericId),
    }));
  }
  const targetSprintId = Number.parseInt(toSectionId.replace('sprint-', ''), 10);
  return sprints.map((s) =>
    s.id === targetSprintId
      ? {
          ...s,
          issuesIds: s.issuesIds.includes(issueNumericId)
            ? s.issuesIds
            : [...s.issuesIds, issueNumericId],
        }
      : { ...s, issuesIds: s.issuesIds.filter((id) => id !== issueNumericId) },
  );
}

/** Rank-persist decision for an intra-section drop. */
export interface IntraSectionRank {
  newOrder: string[];
  previousOrder: string[];
  position: { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never>;
}

/**
 * Resolve whether (and how) an INTRA-section drop should persist a rank change,
 * under the ghost-placeholder model where the dragged key is already live-
 * reordered into its drop slot by drag end.
 *
 * - `liveOrder`    — the section's `localOrder` AFTER live-reorder (drop slot applied).
 * - `preDragOrder` — the section's `localOrder` snapshot from drag start; may be
 *                    undefined when the section had no override yet (a fresh drag).
 * - `serverKeys`   — the server-derived key order for the section.
 *
 * Returns null when there is no net movement (no rank PUT should fire).
 *
 * CRITICAL (regression guard): `previousOrder` falls back to `serverKeys` — NOT
 * `liveOrder` — when there was no pre-drag override. Defaulting to `liveOrder`
 * makes a fresh drag's previousOrder equal newOrder, trips the no-movement
 * guard, and the issue snaps back to its original position with no PUT fired.
 */
export function resolveIntraSectionRank(args: {
  activeKey: string;
  liveOrder: readonly string[];
  preDragOrder: readonly string[] | undefined;
  serverKeys: readonly string[];
}): IntraSectionRank | null {
  const { activeKey, liveOrder, preDragOrder, serverKeys } = args;
  const newOrder = (liveOrder ?? serverKeys).slice();
  const previousOrder = (preDragOrder ?? serverKeys).slice();
  const newIndex = newOrder.indexOf(activeKey);
  if (newIndex === -1 || keyOrderEquals(previousOrder, newOrder)) return null;
  const above = newOrder[newIndex - 1];
  const below = newOrder[newIndex + 1];
  const position: { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never> =
    above !== undefined
      ? { rankAfterIssue: above }
      : below !== undefined
        ? { rankBeforeIssue: below }
        : {};
  return { newOrder, previousOrder, position };
}

/**
 * Resolve the rank-persist decision for an INTRA-section drop under the
 * CANONICAL dnd-kit single-container sortable model (Phase 78-04 jump fix).
 *
 * Unlike `resolveIntraSectionRank` (which assumed `localOrder` had already been
 * live-reordered into the drop slot during the drag), this helper takes the
 * section's order as it stood BEFORE the drop (`currentKeys` — the server order
 * or any prior committed override) and computes the new order ONCE via
 * arrayMove semantics from the drop's `activeKey`/`overKey`. No data is mutated
 * during the drag, so there is no oscillation; dnd-kit owns the in-flight
 * visual row shift and we only persist on release.
 *
 * - `currentKeys` — the section's current key order at drop time.
 * - `activeKey`   — the dragged row's key.
 * - `overKey`     — the key of the row the drop landed on (over.id).
 *
 * Returns null when there is no movement (same index) or either key is missing
 * from `currentKeys` (e.g. dropped on the section droppable, not a row).
 *
 * `previousOrder` is always `currentKeys` (the base the server order is built
 * on) so RANK-04 rollback restores exactly what was displayed pre-drop.
 *
 * `position` is computed from the NEW order's neighbours: rank after the issue
 * directly above when one exists (the dragged row is not at the top), else rank
 * before the issue directly below (dragged row landed at the very top).
 */
export function resolveIntraRankFromDrop(
  currentKeys: readonly string[],
  activeKey: string,
  overKey: string,
): IntraSectionRank | null {
  const oldIndex = currentKeys.indexOf(activeKey);
  const newIndex = currentKeys.indexOf(overKey);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;

  const previousOrder = currentKeys.slice();
  const newOrder = currentKeys.slice();
  newOrder.splice(oldIndex, 1);
  newOrder.splice(newIndex, 0, activeKey);

  const landedIndex = newOrder.indexOf(activeKey);
  const above = newOrder[landedIndex - 1];
  const below = newOrder[landedIndex + 1];
  const position: { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never> =
    above !== undefined
      ? { rankAfterIssue: above }
      : below !== undefined
        ? { rankBeforeIssue: below }
        : {};
  return { newOrder, previousOrder, position };
}

export function resolveCrossSectionDrop(args: {
  activeKey: string;
  activeData: SortableData | undefined;
  overId: string | null;
  overData: SortableData | undefined;
  sectionIds: SectionIdSet;
  getTargetKeys: (sectionId: string) => readonly string[];
}): CrossSectionResolution | null {
  const { activeKey, activeData, overId, overData, sectionIds, getTargetKeys } = args;
  const sourceContainer = resolveSourceContainer(activeData);
  const targetContainer = resolveTargetContainer(overId, overData, sectionIds);
  if (!sourceContainer || !targetContainer) return null;
  if (sourceContainer === targetContainer) return null;

  const targetKeys = getTargetKeys(targetContainer);
  // When dropping directly on a row, insert at the row's position; when
  // dropping on the section droppable id itself, append.
  const overIsRow = !!overData?.sortable?.containerId;
  const insertIndex = overIsRow ? computeInsertIndex(overId, targetKeys) : targetKeys.length;
  const newTargetOrder = buildTargetOrder(targetKeys, activeKey, insertIndex);

  return { sourceContainer, targetContainer, insertIndex, newTargetOrder };
}
