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
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';

const NAV_LINK_CLASS =
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-colors';

export default function Sidebar() {
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
        <Link to="/dashboard" className={NAV_LINK_CLASS}>
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Dashboard</span>
        </Link>

        {/* Work section (role-specific) */}
        {(role === 'developer' || role === 'pm') && (
          <div className="mt-2">
            <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
              Work
            </p>
            {role === 'developer' && (
              <>
                <Link to="/my-tasks" className={NAV_LINK_CLASS}>
                  <CheckSquare className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">My Tasks</span>
                </Link>
                <Link to="/sprint-board" className={NAV_LINK_CLASS}>
                  <KanbanSquare className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">Sprint Board</span>
                </Link>
                <Link to="/mr-attention" className={NAV_LINK_CLASS}>
                  <GitMerge className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">MR Attention</span>
                </Link>
              </>
            )}
            {role === 'pm' && (
              <>
                <Link to="/sprint-progress" className={NAV_LINK_CLASS}>
                  <BarChart2 className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">Sprint Progress</span>
                </Link>
                <Link to="/workload" className={NAV_LINK_CLASS}>
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">Workload</span>
                </Link>
                <Link to="/releases" className={NAV_LINK_CLASS}>
                  <Tag className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">Releases</span>
                </Link>
              </>
            )}
          </div>
        )}

      </nav>

      {/* Bottom: Debug Logs (when enabled) + Settings */}
      <div className="px-2 py-4 border-t border-border flex flex-col gap-1">
        {debugMode && (
          <Link to="/debug-logs" className={NAV_LINK_CLASS}>
            <Bug className="h-4 w-4 shrink-0" />
            <span className="hidden md:block">Debug Logs</span>
          </Link>
        )}
        <Link
          to="/settings"
          className={NAV_LINK_CLASS}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
