/**
 * Sidebar navigation item registry and role presets.
 *
 * All customizable sidebar nav items are defined here as a master list.
 * Settings and Debug Logs are NOT in this list -- they are always pinned
 * at the bottom of the sidebar.
 */

import type { ComponentType } from 'react';
import {
  BarChart2,
  BookOpen,
  CheckSquare,
  GitMerge,
  KanbanSquare,
  LayoutDashboard,
  List,
  Tag,
  Users,
} from 'lucide-react';
import type { SidebarItem } from '@/stores/settings.store';

export interface SidebarNavDef {
  id: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

/** Ordered master list of all customizable sidebar nav items. */
export const SIDEBAR_NAV_ITEMS: SidebarNavDef[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'my-tasks', label: 'My Tasks', path: '/my-tasks', icon: CheckSquare },
  { id: 'sprint-board', label: 'Sprint Board', path: '/sprint-board', icon: KanbanSquare },
  { id: 'backlog', label: 'Backlog', path: '/backlog', icon: List },
  { id: 'epics', label: 'Epics', path: '/epics', icon: BookOpen },
  { id: 'merge-requests', label: 'Merge Requests', path: '/merge-requests', icon: GitMerge },
  { id: 'mr-attention', label: 'MR Attention', path: '/mr-attention', icon: GitMerge },
  { id: 'sprint-progress', label: 'Sprint Progress', path: '/sprint-progress', icon: BarChart2 },
  { id: 'workload', label: 'Workload', path: '/workload', icon: Users },
  { id: 'releases', label: 'Releases', path: '/releases', icon: Tag },
];

/** Dev preset sidebar: dev-focused items visible, PM-only items hidden. */
export const DEV_SIDEBAR_PRESET: SidebarItem[] = [
  { id: 'dashboard', visible: true },
  { id: 'my-tasks', visible: true },
  { id: 'sprint-board', visible: true },
  { id: 'backlog', visible: true },
  { id: 'epics', visible: true },
  { id: 'merge-requests', visible: true },
  { id: 'mr-attention', visible: true },
  { id: 'sprint-progress', visible: false },
  { id: 'workload', visible: false },
  { id: 'releases', visible: false },
];

/** PM preset sidebar: PM-focused items visible, dev-only items hidden. */
export const PM_SIDEBAR_PRESET: SidebarItem[] = [
  { id: 'dashboard', visible: true },
  { id: 'sprint-progress', visible: true },
  { id: 'workload', visible: true },
  { id: 'backlog', visible: true },
  { id: 'epics', visible: true },
  { id: 'merge-requests', visible: true },
  { id: 'releases', visible: true },
  { id: 'my-tasks', visible: false },
  { id: 'sprint-board', visible: false },
  { id: 'mr-attention', visible: false },
];

/** Returns a fresh copy of the role-appropriate sidebar preset. */
export function getDefaultSidebarItems(preset: 'dev' | 'pm'): SidebarItem[] {
  return preset === 'pm' ? [...PM_SIDEBAR_PRESET] : [...DEV_SIDEBAR_PRESET];
}
