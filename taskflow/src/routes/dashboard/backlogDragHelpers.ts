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
 * Full cross-section drop resolution used by handleDragEnd. Returns null when
 * the drop is not a valid cross-section move (no target, or target === source).
 */
export interface CrossSectionResolution {
  sourceContainer: string;
  targetContainer: string;
  insertIndex: number;
  newTargetOrder: string[];
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
