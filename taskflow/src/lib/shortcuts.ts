/**
 * Shortcut registry — static constants defining all keyboard shortcuts in the app.
 *
 * Each entry has a stable `id` slug used as the key for user overrides (future feature).
 * Effective key for a shortcut: overrides[id] ?? defaultKey
 *
 * To add a new shortcut: append to this array. The KeyboardShortcutsPanel reads
 * this array directly — no changes to the panel component needed.
 *
 * Categories: 'Navigation' | 'Lists' | 'Actions' | 'General'
 * Only categories with at least one entry are rendered in the panel.
 */

export type ShortcutCategory = 'Navigation' | 'Lists' | 'Actions' | 'General';

export interface ShortcutEntry {
  /** Stable ID slug — used as the key for user overrides in useSettingsStore.keyboardOverrides */
  id: string;
  /** The default key string as recognized by react-hotkeys-hook (e.g., 'mod+/', 'escape', 'g+s') */
  defaultKey: string;
  /** Human-readable description shown in the shortcuts panel */
  description: string;
  /** Category grouping in the shortcuts panel */
  category: ShortcutCategory;
}

/**
 * All registered keyboard shortcuts.
 *
 * Phase 19: Only the two wired shortcuts are listed.
 * Later phases append entries here when they implement their shortcuts.
 *
 * Panel display order: entries appear in array order within each category.
 */
export const SHORTCUTS: ShortcutEntry[] = [
  {
    id: 'show-shortcuts',
    defaultKey: '⌘/',
    description: 'Show keyboard shortcuts',
    category: 'General',
  },
  {
    id: 'dismiss',
    defaultKey: 'Esc',
    description: 'Dismiss shortcuts panel',
    category: 'General',
  },
];
