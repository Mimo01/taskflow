/**
 * Widget registry and dashboard layout presets.
 *
 * Defines all available dashboard widget types with metadata, size constraints,
 * and real component implementations. All 11 widget types are fully wired.
 */

// biome-ignore assist/source/organizeImports: import order must match module init order to avoid TDZ circular dependency
import type { ComponentType } from 'react';
import {
  BarChart2,
  Bell,
  CheckSquare,
  Filter,
  GitMerge,
  LayoutDashboard,
  Pin,
  Search,
  Tag,
  Users,
} from 'lucide-react';
import type { DashboardLayoutItem } from '@/stores/settings.store';
import SubtasksWidget from './SubtasksWidget';
import MrHealthWidget from './MrHealthWidget';
import SprintHealthWidget from './SprintHealthWidget';
import NotificationsWidget from './NotificationsWidget';
import SprintProgressWidget from './SprintProgressWidget';
import MrAttentionWidget from './MrAttentionWidget';
import ReleasesWidget from './ReleasesWidget';
import WorkloadWidget from './WorkloadWidget';
import SavedFiltersWidget from './SavedFiltersWidget';
import PinnedIssuesWidget from './PinnedIssuesWidget';
import CustomJqlWidget from './CustomJqlWidget';

export interface WidgetDef {
  type: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<{ widgetId: string }>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
}

export const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  'my-subtasks': {
    type: 'my-subtasks',
    title: 'My Subtasks',
    description: 'Open subtasks assigned to you',
    icon: CheckSquare,
    component: SubtasksWidget,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 12, h: 8 },
  },
  'mr-health': {
    type: 'mr-health',
    title: 'MR Health',
    description: 'Merge request status overview',
    icon: GitMerge,
    component: MrHealthWidget,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 12, h: 8 },
  },
  'sprint-health': {
    type: 'sprint-health',
    title: 'Sprint Health',
    description: 'Sprint overview with key metrics',
    icon: LayoutDashboard,
    component: SprintHealthWidget,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 8 },
  },
  'recent-notifications': {
    type: 'recent-notifications',
    title: 'Notifications',
    description: 'Your latest notifications',
    icon: Bell,
    component: NotificationsWidget,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 8, h: 6 },
  },
  'sprint-progress': {
    type: 'sprint-progress',
    title: 'Sprint Progress',
    description: 'Sprint completion with status breakdown',
    icon: BarChart2,
    component: SprintProgressWidget,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 8, h: 6 },
  },
  'mr-attention': {
    type: 'mr-attention',
    title: 'MR Attention',
    description: 'Merge requests needing your review',
    icon: GitMerge,
    component: MrAttentionWidget,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 8, h: 6 },
  },
  'releases-overview': {
    type: 'releases-overview',
    title: 'Releases',
    description: 'Upcoming releases with status',
    icon: Tag,
    component: ReleasesWidget,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 8, h: 6 },
  },
  'workload-summary': {
    type: 'workload-summary',
    title: 'Workload',
    description: 'Team workload at a glance',
    icon: Users,
    component: WorkloadWidget,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 8, h: 6 },
  },
  'saved-filters': {
    type: 'saved-filters',
    title: 'Saved Filters',
    description: 'Quick-access filter shortcuts',
    icon: Filter,
    component: SavedFiltersWidget,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 5 },
  },
  'pinned-issues': {
    type: 'pinned-issues',
    title: 'Pinned Issues',
    description: 'Your pinned issue tabs',
    icon: Pin,
    component: PinnedIssuesWidget,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 5 },
  },
  'custom-jql': {
    type: 'custom-jql',
    title: 'Custom JQL',
    description: 'Issues matching a custom JQL query',
    icon: Search,
    component: CustomJqlWidget,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 12, h: 8 },
  },
};

/** Dev preset dashboard layout. */
export const DEV_DASHBOARD_PRESET: DashboardLayoutItem[] = [
  {
    i: 'my-subtasks-default',
    type: 'my-subtasks',
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    minW: 3,
    minH: 3,
    maxW: 12,
    maxH: 8,
  },
  {
    i: 'mr-health-default',
    type: 'mr-health',
    x: 6,
    y: 0,
    w: 6,
    h: 4,
    minW: 3,
    minH: 3,
    maxW: 12,
    maxH: 8,
  },
  {
    i: 'sprint-health-default',
    type: 'sprint-health',
    x: 0,
    y: 4,
    w: 6,
    h: 4,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
  },
];

/** PM preset dashboard layout. */
export const PM_DASHBOARD_PRESET: DashboardLayoutItem[] = [
  {
    i: 'sprint-health-default',
    type: 'sprint-health',
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
  },
  {
    i: 'sprint-progress-default',
    type: 'sprint-progress',
    x: 6,
    y: 0,
    w: 6,
    h: 3,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 6,
  },
  {
    i: 'workload-summary-default',
    type: 'workload-summary',
    x: 0,
    y: 4,
    w: 6,
    h: 3,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 6,
  },
  {
    i: 'releases-overview-default',
    type: 'releases-overview',
    x: 6,
    y: 3,
    w: 6,
    h: 3,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 6,
  },
];

/** Returns a fresh copy of the role-appropriate dashboard layout preset. */
export function getDefaultDashboardLayout(preset: 'dev' | 'pm'): DashboardLayoutItem[] {
  return (preset === 'pm' ? PM_DASHBOARD_PRESET : DEV_DASHBOARD_PRESET).map((item) => ({
    ...item,
  }));
}
