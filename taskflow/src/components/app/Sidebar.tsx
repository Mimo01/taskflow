/**
 * Sidebar -- App sidebar with navigation links and settings access.
 *
 * Layout: vertical sidebar with store-driven nav items grouped by section.
 * Items and their visibility are controlled by the settings store (sidebarItems).
 * Section grouping is derived from sidebar-items.ts definitions.
 */

import {
  BarChart2,
  BookOpen,
  Bug,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  GitMerge,
  KanbanSquare,
  LayoutDashboard,
  List,
  Settings,
  Tag,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { STALE_TIME_MS } from '@/lib/query-constants';
import { fetchActiveSprint, fetchEpicsBasic, fetchProjectStatuses } from '@/services/jira';
import { fetchSprintStories } from '@/services/jira/issues';
import { fetchBacklogIssues, fetchSprintList } from '@/services/jira/backlog';
import { fetchBoardId } from '@/services/jira/sprints';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import AppIcon from './AppIcon';
import { SIDEBAR_NAV_ITEMS, SIDEBAR_SECTIONS } from './sidebar-items';

/** Map icon names to actual Lucide components */
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  CheckSquare,
  KanbanSquare,
  List,
  BookOpen,
  GitMerge,
  BarChart2,
  Users,
  Tag,
};

const NAV_LINK_BASE =
  'flex items-center py-2 density-compact:py-1 density-comfortable:py-3 rounded-lg text-sm font-medium transition-colors';
function navLinkClassFn(collapsed: boolean) {
  const base = collapsed ? `${NAV_LINK_BASE} justify-center px-2` : `${NAV_LINK_BASE} gap-3 px-3`;
  return ({ isActive }: { isActive: boolean }) =>
    isActive ? `${base} bg-accent text-accent-foreground font-semibold` : `${base} hover:bg-accent`;
}

const PREFETCH_ROUTES = new Set(['/dashboard', '/my-tasks', '/sprint-board', '/backlog', '/epics']);

export default function Sidebar() {
  const { devToolsEnabled, sidebarItems } = useSettingsStore();
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);
  const [hovered, setHovered] = useState(false);

  const queryClient = useQueryClient();
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey, epicColorFieldKey } =
    useSettingsStore();

  // Load jira token for prefetch queryFn calls
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then(setJiraToken)
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function prefetchForPath(path: string) {
    if (!jiraBaseUrl || !jiraToken || !activeJiraProject) return;

    if (path === '/sprint-board' || path === '/dashboard') {
      queryClient.prefetchQuery({
        queryKey: ['jira-sprint-stories', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey],
        queryFn: () => fetchSprintStories(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey, epicLinkFieldKey),
        staleTime: STALE_TIME_MS,
      });
      if (path === '/sprint-board') {
        queryClient.prefetchQuery({
          queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl],
          queryFn: () => fetchActiveSprint(jiraBaseUrl, jiraToken, activeJiraProject),
          staleTime: 5 * 60 * 1000,
        });
        queryClient.prefetchQuery({
          queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
          queryFn: () => fetchEpicsBasic(jiraBaseUrl, jiraToken, activeJiraProject, epicNameFieldKey, epicColorFieldKey),
          staleTime: 5 * 60 * 1000,
        });
        queryClient.prefetchQuery({
          queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
          queryFn: () => fetchProjectStatuses(jiraBaseUrl, jiraToken, activeJiraProject),
          staleTime: Infinity,
        });
      }
    } else if (path === '/backlog' || path === '/epics') {
      queryClient.prefetchQuery({
        queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
        queryFn: () => fetchEpicsBasic(jiraBaseUrl, jiraToken, activeJiraProject, epicNameFieldKey, epicColorFieldKey),
        staleTime: 5 * 60 * 1000,
      });
      if (path === '/backlog') {
        // Sprint stories and backlog issues don't depend on boardId — prefetch immediately.
        queryClient.prefetchQuery({
          queryKey: ['jira-sprint-stories', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey],
          queryFn: () => fetchSprintStories(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey, epicLinkFieldKey),
          staleTime: STALE_TIME_MS,
        });
        queryClient.prefetchQuery({
          queryKey: ['jira-backlog-issues', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey],
          queryFn: () => fetchBacklogIssues(jiraBaseUrl, jiraToken, activeJiraProject, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey),
          staleTime: STALE_TIME_MS,
        });
        // Sprint list needs boardId — resolve first then prefetch.
        queryClient.fetchQuery({
          queryKey: ['jira-board-id', activeJiraProject, jiraBaseUrl],
          queryFn: () => fetchBoardId(jiraBaseUrl, jiraToken, activeJiraProject),
          staleTime: Infinity,
        }).then((boardId) => {
          if (boardId != null) {
            queryClient.prefetchQuery({
              queryKey: ['jira-sprint-list', boardId, jiraBaseUrl],
              queryFn: () => fetchSprintList(jiraBaseUrl, jiraToken, boardId),
              staleTime: STALE_TIME_MS,
            });
          }
        }).catch(() => {
          // Board discovery failed — silently skip sprint-list prefetch.
          // User will still get a normal load when they navigate.
        });
      }
    }
    // /my-tasks uses fetchMyTasksHierarchy which has complex internal logic — skip prefetch.
    // The sprint-stories prefetch covers the dashboard's primary query.
  }

  function handleNavMouseEnter(path: string) {
    if (!PREFETCH_ROUTES.has(path)) return;
    prefetchTimerRef.current = setTimeout(() => {
      prefetchForPath(path);
    }, 100); // 100ms debounce
  }

  function handleNavMouseLeave() {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }

  function handleNavFocus(path: string) {
    if (!PREFETCH_ROUTES.has(path)) return;
    prefetchForPath(path); // immediate on focus
  }

  const navLinkClass = navLinkClassFn(sidebarCollapsed);
  const labelClass = sidebarCollapsed ? 'hidden' : 'hidden md:block';

  // Build lookup of visible item ids from store
  const visibleIds = new Set<string>();
  for (const item of sidebarItems) {
    if (item.visible) visibleIds.add(item.id);
  }

  // Group visible nav items by section
  const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: SIDEBAR_NAV_ITEMS.filter(
      (nav) => nav.section === section.id && visibleIds.has(nav.id),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={`relative flex flex-col h-full ${sidebarCollapsed ? 'w-16' : 'w-16 md:w-56'} border-r border-border bg-background shrink-0 transition-all duration-200`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover chevron toggle */}
      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        className={`absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full border border-border bg-background shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Branding */}
      <div
        className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-4 border-b border-border`}
      >
        <AppIcon className="w-8 h-8 shrink-0" />
        <span className={`text-base font-semibold text-foreground ${labelClass}`}>Taskflow</span>
      </div>

      {/* Nav links grouped by section */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-4 flex flex-col gap-1">
        {sectionedItems.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            {!sidebarCollapsed && (
              <span className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hidden md:block">
                {section.label}
              </span>
            )}
            {section.items.map((nav) => {
              const Icon = ICON_MAP[nav.iconName];
              return (
                <NavLink
                  key={nav.id}
                  to={nav.path}
                  className={navLinkClass}
                  title={sidebarCollapsed ? nav.label : undefined}
                  onMouseEnter={() => handleNavMouseEnter(nav.path)}
                  onMouseLeave={handleNavMouseLeave}
                  onFocus={() => handleNavFocus(nav.path)}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                  <span className={labelClass}>{nav.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: Dev Tools (when enabled) + Settings */}
      <div className="px-2 py-4 border-t border-border flex flex-col gap-1">
        {devToolsEnabled && (
          <NavLink
            to="/dev-tools"
            className={navLinkClass}
            title={sidebarCollapsed ? 'Dev Tools' : undefined}
          >
            <Bug className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Dev Tools</span>
          </NavLink>
        )}
        <NavLink
          to="/settings"
          className={navLinkClass}
          aria-label="Settings"
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className={labelClass}>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
