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

export type ShortcutCategory = 'Navigation' | 'Lists' | 'Actions' | 'General' | 'Editor';

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
    defaultKey: 'mod+shift+f',
    description: 'Open command palette',
    category: 'General',
    displayKeys: ['⌘', '⇧', 'F'],
  },
  {
    id: 'find-in-page',
    defaultKey: 'mod+f',
    description: 'Find in page',
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
    id: 'toggle-notifications',
    defaultKey: 'mod+shift+i',
    description: 'Open or close notifications',
    category: 'Navigation',
    displayKeys: ['⌘', '⇧', 'I'],
    navMeta: { label: 'Notifications', action: 'open-notifications' },
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
  // Editor shortcuts: documentation only (defaultKey is prefixed 'editor:' to stay unique), handled by the editor's own keymap while it has focus.
  // The editor-trigger-* rows (@, /, :) are informational: the suggestion plugins own those characters.
  // Never bound as global hotkeys. Cmd+B / Cmd+Shift+B / Cmd+Shift+M equal global chords and are
  // safe only because react-hotkeys-hook ignores contenteditable and textarea targets (no
  // enableOnContentEditable anywhere in src). Sub/superscript use Cmd+Shift+, and Cmd+Shift+.
  // because Cmd+, opens Settings.
  {
    id: 'editor-bold',
    defaultKey: 'editor:⌘B',
    description: 'Bold while editing',
    category: 'Editor',
    displayKeys: ['⌘', 'B'],
  },
  {
    id: 'editor-italic',
    defaultKey: 'editor:⌘I',
    description: 'Italic while editing',
    category: 'Editor',
    displayKeys: ['⌘', 'I'],
  },
  {
    id: 'editor-underline',
    defaultKey: 'editor:⌘U',
    description: 'Underline while editing',
    category: 'Editor',
    displayKeys: ['⌘', 'U'],
  },
  {
    id: 'editor-strike',
    defaultKey: 'editor:⌘⇧X',
    description: 'Strikethrough while editing',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', 'X'],
  },
  {
    id: 'editor-mono',
    defaultKey: 'editor:⌘E',
    description: 'Monospace while editing',
    category: 'Editor',
    displayKeys: ['⌘', 'E'],
  },
  {
    id: 'editor-superscript',
    defaultKey: 'editor:⌘⇧.',
    description: 'Superscript while editing',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', '.'],
  },
  {
    id: 'editor-subscript',
    defaultKey: 'editor:⌘⇧,',
    description: 'Subscript while editing',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', ','],
  },
  {
    id: 'editor-link',
    defaultKey: 'editor:⌘K',
    description: 'Insert link while editing',
    category: 'Editor',
    displayKeys: ['⌘', 'K'],
  },
  {
    id: 'editor-bullet-list',
    defaultKey: 'editor:⌘⇧8',
    description: 'Bulleted list while editing',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', '8'],
  },
  {
    id: 'editor-numbered-list',
    defaultKey: 'editor:⌘⇧7',
    description: 'Numbered list while editing',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', '7'],
  },
  {
    id: 'editor-quote',
    defaultKey: 'editor:⌘⇧B',
    description: 'Quote while editing',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', 'B'],
  },
  {
    id: 'editor-toggle-source',
    defaultKey: 'editor:⌘⇧M',
    description: 'Toggle source view while editing',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', 'M'],
  },
  {
    id: 'editor-undo',
    defaultKey: 'editor:⌘Z',
    description: 'Undo while editing',
    category: 'Editor',
    displayKeys: ['⌘', 'Z'],
  },
  {
    id: 'editor-redo',
    defaultKey: 'editor:⌘⇧Z',
    description: 'Redo while editing',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', 'Z'],
  },
  {
    id: 'editor-paste-plain',
    defaultKey: 'editor:⌘⇧V',
    description: 'Paste as plain text',
    category: 'Editor',
    displayKeys: ['⌘', '⇧', 'V'],
  },
  {
    id: 'editor-trigger-mention',
    defaultKey: 'editor:@',
    description: 'Mention @',
    category: 'Editor',
    displayKeys: ['@'],
  },
  {
    id: 'editor-trigger-slash',
    defaultKey: 'editor:/',
    description: 'Insert menu /',
    category: 'Editor',
    displayKeys: ['/'],
  },
  {
    id: 'editor-trigger-emoticon',
    defaultKey: 'editor::',
    description: 'Emoticon :',
    category: 'Editor',
    displayKeys: [':'],
  },
  {
    id: 'editor-submit',
    defaultKey: 'editor:⌘↵',
    description: 'Submit editor or form',
    category: 'Editor',
    displayKeys: ['⌘', '↵'],
  },
  {
    id: 'editor-cancel',
    defaultKey: 'editor:Esc',
    description: 'Cancel editing / leave editor',
    category: 'Editor',
    displayKeys: ['Esc'],
  },
];

/** Navigation shortcuts with navMeta guaranteed present -- used by CommandPalette */
export const NAV_SHORTCUTS = SHORTCUTS.filter(
  (s): s is ShortcutEntry & { navMeta: NavMeta } => s.category === 'Navigation' && !!s.navMeta,
);
