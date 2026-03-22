/**
 * Board selection store -- multi-select state for bulk operations on sprint board cards.
 *
 * Session-only (no persist) -- selections reset on app restart.
 * Supports single toggle, range selection (Shift+click), and programmatic batch select.
 */
import { create } from 'zustand';

interface BoardSelectionState {
  selectedKeys: Set<string>;
  lastClickedKey: string | null;
  hasSelection: boolean;
  toggleSelection: (key: string) => void;
  rangeSelect: (fromKey: string, toKey: string, allKeys: string[]) => void;
  clearSelection: () => void;
  selectKeys: (keys: string[]) => void;
  isSelected: (key: string) => boolean;
}

export const useBoardSelectionStore = create<BoardSelectionState>()((set, get) => ({
  selectedKeys: new Set<string>(),
  lastClickedKey: null,
  hasSelection: false,
  toggleSelection: (key) =>
    set((state) => {
      const next = new Set(state.selectedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { selectedKeys: next, lastClickedKey: key, hasSelection: next.size > 0 };
    }),
  rangeSelect: (fromKey, toKey, allKeys) =>
    set((state) => {
      const fromIdx = allKeys.indexOf(fromKey);
      const toIdx = allKeys.indexOf(toKey);
      if (fromIdx === -1 || toIdx === -1) return state;
      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);
      const next = new Set(state.selectedKeys);
      for (let i = start; i <= end; i++) next.add(allKeys[i]);
      return { selectedKeys: next, lastClickedKey: toKey, hasSelection: next.size > 0 };
    }),
  clearSelection: () =>
    set({ selectedKeys: new Set<string>(), lastClickedKey: null, hasSelection: false }),
  selectKeys: (keys) =>
    set({
      selectedKeys: new Set(keys),
      lastClickedKey: keys[keys.length - 1] ?? null,
      hasSelection: keys.length > 0,
    }),
  isSelected: (key) => get().selectedKeys.has(key),
}));
