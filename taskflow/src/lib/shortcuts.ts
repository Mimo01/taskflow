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

export interface NavMeta {
  /** The label shown in the command palette (e.g., "Sprint Board") */
  label: string;
  /** Route path for onNavigate (e.g., '/sprint-board'). Mutually exclusive with `action`. */
  route?: string;
  /** Named action key for special handlers (e.g., 'open-notifications'). Mutually exclusive with `route`. */
  action?: string;
}

export interface ShortcutEntry {
  /** Stable ID slug — used as the key for user overrides in useSettingsStore.keyboardOverrides */
  id: string;
  /** The default key string as recognized by react-hotkeys-hook (e.g., 'mod+/', 'escape', 'g+s') */
  defaultKey: string;
  /** Human-readable description shown in the shortcuts panel */
  description: string;
  /** Category grouping in the shortcuts panel */
  category: ShortcutCategory;
  /** Navigation metadata -- only present on Navigation category entries */
  navMeta?: NavMeta;
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
  {
    id: 'open-palette',
    defaultKey: '⌘K',
    description: 'Open command palette',
    category: 'General',
  },
  {
    id: 'nav-sprint',
    defaultKey: '⌘⇧S',
    description: 'Go to Sprint Board',
    category: 'Navigation',
    navMeta: { label: 'Sprint Board', route: '/sprint-board' },
  },
  {
    id: 'nav-backlog',
    defaultKey: '⌘⇧B',
    description: 'Go to Backlog',
    category: 'Navigation',
    navMeta: { label: 'Backlog', route: '/backlog' },
  },
  {
    id: 'nav-notifications',
    defaultKey: '⌘⇧N',
    description: 'Open Notifications',
    category: 'Navigation',
    navMeta: { label: 'Notifications', action: 'open-notifications' },
  },
  {
    id: 'nav-settings',
    defaultKey: '⌘,',
    description: 'Open Settings',
    category: 'Navigation',
    navMeta: { label: 'Settings', route: '/settings' },
  },
  {
    id: 'list-next',
    defaultKey: 'J',
    description: 'Next item',
    category: 'Lists',
  },
  {
    id: 'list-prev',
    defaultKey: 'K',
    description: 'Previous item',
    category: 'Lists',
  },
  {
    id: 'list-open',
    defaultKey: 'Enter',
    description: 'Open item',
    category: 'Lists',
  },
];

/** Navigation shortcuts with navMeta guaranteed present -- used by CommandPalette */
export const NAV_SHORTCUTS = SHORTCUTS.filter(
  (s): s is ShortcutEntry & { navMeta: NavMeta } => s.category === 'Navigation' && !!s.navMeta
);
