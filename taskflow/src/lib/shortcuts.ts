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
    defaultKey: 'mod+f',
    description: 'Open command palette',
    category: 'General',
    displayKeys: ['⌘', 'F'],
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
    id: 'nav-settings',
    defaultKey: '⌘,',
    description: 'Open Settings',
    category: 'Navigation',
    displayKeys: ['⌘', ','],
    navMeta: { label: 'Settings', route: '/settings' },
  },
  {
    id: 'nav-dashboard',
    defaultKey: 'mod+shift+d',
    description: 'Go to Dashboard',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'D'],
    navMeta: { label: 'Dashboard', route: '/dashboard' },
  },
  {
    id: 'nav-my-tasks',
    defaultKey: 'mod+shift+t',
    description: 'Go to My Tasks',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'T'],
    navMeta: { label: 'My Tasks', route: '/my-tasks' },
  },
  {
    id: 'nav-standup',
    defaultKey: 'mod+shift+n',
    description: 'Go to Standup Notes',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'N'],
    navMeta: { label: 'Standup Notes', route: '/standup-notes' },
  },
  {
    id: 'nav-epics',
    defaultKey: 'mod+shift+e',
    description: 'Go to Epics',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'E'],
    navMeta: { label: 'Epics', route: '/epics' },
  },
  {
    id: 'nav-merge-requests',
    defaultKey: 'mod+shift+m',
    description: 'Go to Merge Requests',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'M'],
    navMeta: { label: 'Merge Requests', route: '/merge-requests' },
  },
  {
    id: 'nav-releases',
    defaultKey: 'mod+shift+r',
    description: 'Go to Releases',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'R'],
    navMeta: { label: 'Releases', route: '/releases' },
  },
  {
    id: 'nav-worklogs',
    defaultKey: 'mod+shift+w',
    description: 'Go to Worklogs',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'W'],
    navMeta: { label: 'Worklogs', route: '/worklogs' },
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
