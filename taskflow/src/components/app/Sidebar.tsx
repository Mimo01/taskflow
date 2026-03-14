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
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';

const NAV_LINK_CLASS =
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? `${NAV_LINK_CLASS} bg-accent text-accent-foreground font-semibold`
    : `${NAV_LINK_CLASS} hover:bg-accent`;

interface SidebarProps {
  onOpenCreate: () => void;
}

export default function Sidebar({ onOpenCreate }: SidebarProps) {
  const { role, debugMode } = useSettingsStore();

  return (
    <aside className="flex flex-col h-full w-16 md:w-56 border-r border-border bg-background shrink-0">
      {/* App name / logo */}
      <div className="px-4 py-5 border-b border-border">
        <span className="font-bold text-lg hidden md:block">Taskflow</span>
        <span className="font-bold text-lg md:hidden">TF</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        <NavLink to="/dashboard" className={navLinkClass}>
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Dashboard</span>
        </NavLink>

        <button
          type="button"
          onClick={onOpenCreate}
          className={`${NAV_LINK_CLASS} hover:bg-accent`}
        >
          <PlusSquare className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Create Issue</span>
        </button>

        {/* Work section (role-specific) */}
        {(role === 'developer' || role === 'pm' || role === 'tech-lead') && (
          <div className="mt-2">
            {/* Developer and PM roles: single "Work" label */}
            {(role === 'developer' || role === 'pm') && (
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
                Work
              </p>
            )}

            {/* Developer role links */}
            {(role === 'developer' || role === 'tech-lead') && (
              <>
                {role === 'tech-lead' && (
                  <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
                    Developer
                  </p>
                )}
                <NavLink to="/my-tasks" className={navLinkClass}>
                  <CheckSquare className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">My Tasks</span>
                </NavLink>
                <NavLink to="/sprint-board" className={navLinkClass}>
                  <KanbanSquare className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">Sprint Board</span>
                </NavLink>
                <NavLink to="/mr-attention" className={navLinkClass}>
                  <GitMerge className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">MR Attention</span>
                </NavLink>
              </>
            )}

            {/* PM role links */}
            {(role === 'pm' || role === 'tech-lead') && (
              <>
                {role === 'tech-lead' && (
                  <p className="px-3 py-1 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
                    PM
                  </p>
                )}
                <NavLink to="/sprint-progress" className={navLinkClass}>
                  <BarChart2 className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">Sprint Progress</span>
                </NavLink>
                <NavLink to="/workload" className={navLinkClass}>
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">Workload</span>
                </NavLink>
                <NavLink to="/releases" className={navLinkClass}>
                  <Tag className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">Releases</span>
                </NavLink>
              </>
            )}
          </div>
        )}

      </nav>

      {/* Bottom: Debug Logs (when enabled) + Settings */}
      <div className="px-2 py-4 border-t border-border flex flex-col gap-1">
        {debugMode && (
          <NavLink to="/debug-logs" className={navLinkClass}>
            <Bug className="h-4 w-4 shrink-0" />
            <span className="hidden md:block">Debug Logs</span>
          </NavLink>
        )}
        <NavLink
          to="/settings"
          className={navLinkClass}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
