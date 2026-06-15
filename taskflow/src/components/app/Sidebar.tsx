/**
 * Sidebar -- App sidebar with navigation links and settings access.
 *
 * Layout: vertical sidebar with store-driven nav items grouped by section.
 * Items and their visibility are controlled by the settings store (sidebarItems).
 * Section grouping is derived from sidebar-items.ts definitions.
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart2,
  BookOpen,
  Bug,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FlaskConical,
  GitMerge,
  KanbanSquare,
  LayoutDashboard,
  List,
  Rocket,
  Settings,
  Tag,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useResizable } from '@/hooks/useResizable';
import {
  fetchActiveSprint,
  fetchEpicsBasic,
  fetchProjectStatuses,
  getGhAllData,
  getGhBacklogData,
} from '@/services/jira';
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
  ClipboardList,
  KanbanSquare,
  List,
  BookOpen,
  Clock,
  FlaskConical,
  GitMerge,
  BarChart2,
  Users,
  Tag,
  Rocket,
};

const NAV_LINK_BASE =
  'flex items-center py-2 density-compact:py-1 density-comfortable:py-3 rounded-lg text-sm font-medium transition-colors';
function navLinkClassFn(collapsed: boolean) {
  const base = collapsed ? `${NAV_LINK_BASE} justify-center px-2` : `${NAV_LINK_BASE} gap-3 px-3`;
  return ({ isActive }: { isActive: boolean }) =>
    isActive ? `${base} bg-accent text-accent-foreground font-semibold` : `${base} hover:bg-accent`;
}

const PREFETCH_ROUTES = new Set(['/dashboard', '/sprint-board', '/backlog', '/epics']);

export default function Sidebar() {
  // IN-01: fine-grained selectors avoid re-rendering Sidebar on every unrelated
  // settings-store mutation. Match the pattern already used below for
  // sidebarCollapsed / sidebarWidth.
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const sidebarItems = useSettingsStore((s) => s.sidebarItems);
  const aioEnabled = useSettingsStore((s) => s.aioEnabled);
  const selectedAioProjectKey = useSettingsStore((s) => s.selectedAioProjectKey);
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);
  const setSidebarWidth = useSettingsStore((s) => s.setSidebarWidth);
  const { width, isDragging, handleMouseDown } = useResizable({
    initialWidth: sidebarWidth,
    min: 160,
    max: 320,
    onCommit: setSidebarWidth,
  });
  const [hovered, setHovered] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);

  const queryClient = useQueryClient();
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const epicNameFieldKey = useSettingsStore((s) => s.epicNameFieldKey);
  const epicColorFieldKey = useSettingsStore((s) => s.epicColorFieldKey);

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

  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
      }
    };
  }, []);

  function prefetchForPath(path: string) {
    if (!jiraBaseUrl || !jiraToken || !activeJiraProject) return;

    if (path === '/sprint-board' || path === '/dashboard') {
      // FB8-3: honor a user-chosen board id when one is stored for this project,
      // otherwise fall back to discovery (first board). Resolving the stored id
      // first keeps the prefetch on the same board the live views render.
      const storedBoardId = useAuthStore.getState().jiraBoardIds?.[activeJiraProject];
      const resolveBoardId =
        storedBoardId != null
          ? Promise.resolve<number | null>(storedBoardId)
          : queryClient.fetchQuery({
              queryKey: ['jira-board-id', activeJiraProject, jiraBaseUrl],
              queryFn: () => fetchBoardId(jiraBaseUrl, jiraToken, activeJiraProject),
              staleTime: Infinity,
            });
      // Phase 73 Plan 03 (D-08 / D-08a): warm getGhAllData via the resolved
      // boardId async-chain pattern. D-08a: silently skip when boardId is null.
      resolveBoardId
        .then((boardId) => {
          if (boardId == null) return; // D-08a guard
          return getGhAllData(queryClient, jiraBaseUrl, jiraToken, boardId);
        })
        .catch(() => {});
      // Phase 83 D-10 Option B: warm active-sprint for /dashboard so SprintHealthSection
      // reads endDate with enabled:false (zero new API calls on Dashboard load).
      resolveBoardId
        .then((boardId) => {
          queryClient.prefetchQuery({
            queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
            queryFn: () =>
              fetchActiveSprint(jiraBaseUrl, jiraToken, activeJiraProject, boardId ?? undefined),
            staleTime: 5 * 60 * 1000,
          });
        })
        .catch(() => {});
      if (path === '/sprint-board') {
        queryClient.prefetchQuery({
          queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
          queryFn: () =>
            fetchEpicsBasic(
              jiraBaseUrl,
              jiraToken,
              activeJiraProject,
              epicNameFieldKey,
              epicColorFieldKey,
            ),
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
        queryFn: () =>
          fetchEpicsBasic(
            jiraBaseUrl,
            jiraToken,
            activeJiraProject,
            epicNameFieldKey,
            epicColorFieldKey,
          ),
        staleTime: 5 * 60 * 1000,
      });
      if (path === '/backlog') {
        // Phase 74 Plan 04 (D-08 / D-08a): collapse the legacy three-fetcher
        // chain into a single `getGhBacklogData(boardId)` warm-up that targets
        // the same `['gh-backlog', boardId]` cache key BacklogPage reads.
        // Mirrors the `/sprint-board` branch above with `getGhAllData` swapped
        // for `getGhBacklogData`. D-08a: silently skip when boardId is null.
        queryClient
          .fetchQuery({
            queryKey: ['jira-board-id', activeJiraProject, jiraBaseUrl],
            queryFn: () => fetchBoardId(jiraBaseUrl, jiraToken, activeJiraProject),
            staleTime: Infinity,
          })
          .then((boardId) => {
            if (boardId == null) return; // D-08a guard
            return getGhBacklogData(queryClient, jiraBaseUrl, jiraToken, boardId);
          })
          .catch(() => {});
      }
    }
  }

  function handleNavMouseEnter(path: string) {
    if (!PREFETCH_ROUTES.has(path)) return;
    // WR-03: clear any prior pending timer before scheduling a new one. If
    // the user moves between PREFETCH_ROUTES navlinks faster than the 100ms
    // debounce (or interleaves keyboard focus with hover so no
    // mouseleave fires), the previous timer would otherwise still fire and
    // produce a redundant boardId resolve + GH envelope fetch.
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }
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
      (nav) =>
        nav.section === section.id &&
        (nav.id === 'worklogs' ? tempoEnabled && visibleIds.has(nav.id) : visibleIds.has(nav.id)) &&
        !(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey)),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={`relative flex flex-col h-full border-r border-border bg-background shrink-0${isDragging ? '' : ' transition-all duration-200'}`}
      style={{ width: sidebarCollapsed ? 64 : width }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!sidebarCollapsed && (
        <div
          aria-hidden="true"
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setHandleHovered(true)}
          onMouseLeave={() => setHandleHovered(false)}
          style={{ borderColor: isDragging || handleHovered ? 'var(--ring)' : undefined }}
          className="absolute -right-px top-0 h-full w-3 cursor-ew-resize z-20 border-r border-border transition-colors duration-100"
        />
      )}
      {/* Hover chevron toggle */}
      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        className={`absolute -right-3 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-6 h-6 rounded-full border border-border bg-background shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
        className={`flex items-center py-1.5 border-b border-border transition-all duration-200 ${sidebarCollapsed ? 'justify-center px-2' : 'px-3.5'}`}
      >
        {sidebarCollapsed ? (
          <AppIcon className="w-8 h-8" />
        ) : (
          <div className="hidden md:flex items-center gap-1.5 select-none">
            <AppIcon className="w-14 h-14 shrink-0" />
            <div className="flex flex-col leading-none">
              <span className="text-lg font-extrabold tracking-tight text-foreground">
                task<span className="text-[#f97316]">flow</span>
              </span>
              <span className="text-[9px] font-medium tracking-[0.16em] text-muted-foreground/35 uppercase mt-0.5">
                manage &amp; track
              </span>
            </div>
          </div>
        )}
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
              // Phase 55 D-10: 'aio-projects' nav item deep-links to the configured project.
              // The filter above guarantees selectedAioProjectKey is non-null when this branch is hit;
              // the `?? ''` is defensive belt-and-braces in case the gate is ever loosened.
              // WR-02: encodeURIComponent protects against any future project-key shape
              // containing URL-reserved characters (`/`, `?`, `#`, space).
              const navTo =
                nav.id === 'aio-projects'
                  ? `/aio-project/${encodeURIComponent(selectedAioProjectKey ?? '')}`
                  : nav.path;
              return (
                <NavLink
                  key={nav.id}
                  to={navTo}
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
