/**
 * Sidebar — App sidebar with navigation links and settings access.
 *
 * Layout: vertical sidebar. Contains:
 * - App name/logo at top
 * - Dashboard link (always present)
 * - Role-conditional nav links: developer sees My Tasks, Sprint Board, MR Attention;
 *   PM sees Sprint Progress, Workload, Releases
 * - Bottom: Settings link
 *
 * Gear icon is always one click away from anywhere in the app.
 */
import { NavLink } from 'react-router-dom';
import {
  Settings,
  LayoutDashboard,
  CheckSquare,
  KanbanSquare,
  GitMerge,
  BarChart2,
  Users,
  Tag,
  Bug,
  PlusSquare,
  List,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';
import AppIcon from './AppIcon';

const NAV_LINK_CLASS =
  'flex items-center gap-3 px-3 py-2 density-compact:py-1 density-comfortable:py-3 rounded-lg text-sm font-medium transition-colors';
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? `${NAV_LINK_CLASS} bg-accent text-accent-foreground font-semibold`
    : `${NAV_LINK_CLASS} hover:bg-accent`;

interface SidebarProps {
  onOpenCreate: () => void;
}

export default function Sidebar({ onOpenCreate }: SidebarProps) {
  const { role, debugMode } = useSettingsStore();
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);

  const labelClass = sidebarCollapsed ? 'hidden' : 'hidden md:block';
  const sectionLabelClass = sidebarCollapsed
    ? 'hidden'
    : 'px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block';

  return (
    <aside className={`flex flex-col h-full ${sidebarCollapsed ? 'w-16' : 'w-16 md:w-56'} border-r border-border bg-background shrink-0 transition-all duration-200`}>
      {/* Branding */}
      <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-4 border-b border-border`}>
        <AppIcon className="w-8 h-8 shrink-0" />
        <span className={`text-base font-semibold text-foreground ${labelClass}`}>Taskflow</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-4 flex flex-col gap-1">
        <NavLink to="/dashboard" className={navLinkClass} title={sidebarCollapsed ? 'Dashboard' : undefined}>
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className={labelClass}>Dashboard</span>
        </NavLink>

        <button
          type="button"
          onClick={onOpenCreate}
          className={`${NAV_LINK_CLASS} hover:bg-accent`}
          title={sidebarCollapsed ? 'Create Issue' : undefined}
        >
          <PlusSquare className="h-4 w-4 shrink-0" />
          <span className={labelClass}>Create Issue</span>
        </button>

        {/* Shared: Epics (visible for all roles) */}
        <NavLink to="/epics" className={navLinkClass} title={sidebarCollapsed ? 'Epics' : undefined}>
          <BookOpen className="h-4 w-4 shrink-0" />
          <span className={labelClass}>Epics</span>
        </NavLink>

        {/* Work section (role-specific) */}
        {(role === 'developer' || role === 'pm' || role === 'tech-lead') && (
          <div className="mt-2">
            {/* Developer and PM roles: single "Work" label */}
            {(role === 'developer' || role === 'pm') && (
              <p className={sectionLabelClass}>
                Work
              </p>
            )}

            {/* Developer role links */}
            {(role === 'developer' || role === 'tech-lead') && (
              <>
                {role === 'tech-lead' && (
                  <p className={sectionLabelClass}>
                    Developer
                  </p>
                )}
                <NavLink to="/my-tasks" className={navLinkClass} title={sidebarCollapsed ? 'My Tasks' : undefined}>
                  <CheckSquare className="h-4 w-4 shrink-0" />
                  <span className={labelClass}>My Tasks</span>
                </NavLink>
                <NavLink to="/sprint-board" className={navLinkClass} title={sidebarCollapsed ? 'Sprint Board' : undefined}>
                  <KanbanSquare className="h-4 w-4 shrink-0" />
                  <span className={labelClass}>Sprint Board</span>
                </NavLink>
                <NavLink to="/backlog" className={navLinkClass} title={sidebarCollapsed ? 'Backlog' : undefined}>
                  <List className="h-4 w-4 shrink-0" />
                  <span className={labelClass}>Backlog</span>
                </NavLink>
                <NavLink to="/mr-attention" className={navLinkClass} title={sidebarCollapsed ? 'MR Attention' : undefined}>
                  <GitMerge className="h-4 w-4 shrink-0" />
                  <span className={labelClass}>MR Attention</span>
                </NavLink>
              </>
            )}

            {/* PM role links */}
            {(role === 'pm' || role === 'tech-lead') && (
              <>
                {role === 'tech-lead' && (
                  <p className={`${sectionLabelClass} mt-2`}>
                    PM
                  </p>
                )}
                <NavLink to="/sprint-progress" className={navLinkClass} title={sidebarCollapsed ? 'Sprint Progress' : undefined}>
                  <BarChart2 className="h-4 w-4 shrink-0" />
                  <span className={labelClass}>Sprint Progress</span>
                </NavLink>
                <NavLink to="/workload" className={navLinkClass} title={sidebarCollapsed ? 'Workload' : undefined}>
                  <Users className="h-4 w-4 shrink-0" />
                  <span className={labelClass}>Workload</span>
                </NavLink>
                <NavLink to="/backlog" className={navLinkClass} title={sidebarCollapsed ? 'Backlog' : undefined}>
                  <List className="h-4 w-4 shrink-0" />
                  <span className={labelClass}>Backlog</span>
                </NavLink>
                <NavLink to="/releases" className={navLinkClass} title={sidebarCollapsed ? 'Releases' : undefined}>
                  <Tag className="h-4 w-4 shrink-0" />
                  <span className={labelClass}>Releases</span>
                </NavLink>
              </>
            )}
          </div>
        )}

      </nav>

      {/* Toggle button */}
      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        className="mx-2 mb-1 flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      {/* Bottom: Debug Logs (when enabled) + Settings */}
      <div className="px-2 py-4 border-t border-border flex flex-col gap-1">
        {debugMode && (
          <NavLink to="/debug-logs" className={navLinkClass} title={sidebarCollapsed ? 'Debug Logs' : undefined}>
            <Bug className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Debug Logs</span>
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
