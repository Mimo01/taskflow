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
  /** Individual keycap strings for split-badge rendering (e.g., ['⌘', '/'] instead of '⌘/') */
  displayKeys?: string[];
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
    displayKeys: ['⌘', '/'],
  },
  {
    id: 'dismiss',
    defaultKey: 'Esc',
    description: 'Dismiss shortcuts panel',
    category: 'General',
    displayKeys: ['Esc'],
  },
  {
    id: 'open-palette',
    defaultKey: '⌘K',
    description: 'Open command palette',
    category: 'General',
    displayKeys: ['⌘', 'K'],
  },
  {
    id: 'nav-sprint',
    defaultKey: '⌘⇧S',
    description: 'Go to Sprint Board',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'S'],
    navMeta: { label: 'Sprint Board', route: '/sprint-board' },
  },
  {
    id: 'nav-backlog',
    defaultKey: '⌘⇧B',
    description: 'Go to Backlog',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'B'],
    navMeta: { label: 'Backlog', route: '/backlog' },
  },
  {
    id: 'nav-notifications',
    defaultKey: '⌘⇧N',
    description: 'Open Notifications',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'N'],
    navMeta: { label: 'Notifications', action: 'open-notifications' },
  },
  {
    id: 'nav-settings',
    defaultKey: '⌘,',
    description: 'Open Settings',
    category: 'Navigation',
    displayKeys: ['⌘', ','],
    navMeta: { label: 'Settings', route: '/settings' },
  },
  {
    id: 'toggle-sidebar',
    defaultKey: '⌘B',
    description: 'Toggle sidebar',
    category: 'General',
    displayKeys: ['⌘', 'B'],
  },
  {
    id: 'list-next',
    defaultKey: 'J',
    description: 'Next item',
    category: 'Lists',
    displayKeys: ['J'],
  },
  {
    id: 'list-prev',
    defaultKey: 'K',
    description: 'Previous item',
    category: 'Lists',
    displayKeys: ['K'],
  },
  {
    id: 'list-open',
    defaultKey: 'Enter',
    description: 'Open item',
    category: 'Lists',
    displayKeys: ['Enter'],
  },
];

/** Navigation shortcuts with navMeta guaranteed present -- used by CommandPalette */
export const NAV_SHORTCUTS = SHORTCUTS.filter(
  (s): s is ShortcutEntry & { navMeta: NavMeta } => s.category === 'Navigation' && !!s.navMeta,
);
