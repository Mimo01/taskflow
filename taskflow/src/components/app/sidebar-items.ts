/**
 * Sidebar navigation item definitions.
 *
 * Central registry of all sidebar nav items. Each item has an id, label, path,
 * and section assignment. The settings store tracks which items are visible
 * and their order; this file provides the canonical definitions.
 */

export interface SidebarNavDef {
  id: string;
  label: string;
  path: string;
  /** Lucide icon name — resolved at render time by Sidebar.tsx */
  iconName: string;
  /** Visual grouping section */
  section: string;
  /** When true, item cannot be hidden — checkbox is checked and disabled in settings */
  alwaysVisible?: boolean;
}

export interface SidebarItem {
  id: string;
  visible: boolean;
}

export const SIDEBAR_SECTIONS: { id: string; label: string }[] = [
  { id: 'main', label: 'Main' },
  { id: 'planning', label: 'Planning' },
  { id: 'code', label: 'Code' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'testing', label: 'Testing' },
];

export const SIDEBAR_NAV_ITEMS: SidebarNavDef[] = [
  // Main
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    iconName: 'LayoutDashboard',
    section: 'main',
    alwaysVisible: true,
  },
  {
    id: 'my-tasks',
    label: 'My Tasks',
    path: '/my-tasks',
    iconName: 'CheckSquare',
    section: 'main',
  },
  {
    id: 'standup-notes',
    label: 'Standup Notes',
    path: '/standup-notes',
    iconName: 'ClipboardList',
    section: 'main',
  },
  // Planning
  {
    id: 'sprint-board',
    label: 'Sprint Board',
    path: '/sprint-board',
    iconName: 'KanbanSquare',
    section: 'planning',
  },
  { id: 'backlog', label: 'Backlog', path: '/backlog', iconName: 'List', section: 'planning' },
  { id: 'epics', label: 'Epics', path: '/epics', iconName: 'BookOpen', section: 'planning' },
  // Code
  {
    id: 'merge-requests',
    label: 'Merge Requests',
    path: '/merge-requests',
    iconName: 'GitMerge',
    section: 'code',
  },
  // Tracking
  { id: 'releases', label: 'Releases', path: '/releases', iconName: 'Rocket', section: 'tracking' },
  { id: 'worklogs', label: 'Worklogs', path: '/worklogs', iconName: 'Clock', section: 'tracking' },
  // Testing (AIO)
  {
    id: 'aio-projects',
    label: 'AIO Cycles',
    // WR-04 sentinel — Sidebar.tsx computes the real `to` from selectedAioProjectKey
    // (Phase 55 D-10). Use `#aio-dynamic` instead of a real-looking URL path so a
    // future `/aio` route cannot accidentally collide with this placeholder.
    path: '#aio-dynamic',
    iconName: 'FlaskConical',
    section: 'testing',
  },
];

/**
 * Returns all sidebar nav items with visible: true (all items shown by default).
 */
export function getDefaultSidebarItems(): SidebarItem[] {
  return SIDEBAR_NAV_ITEMS.map((item) => ({
    id: item.id,
    visible: true,
  }));
}
