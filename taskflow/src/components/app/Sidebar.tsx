/**
 * Sidebar — App sidebar with navigation links and settings access.
 *
 * Layout: vertical sidebar. Contains:
 * - App name/logo at top
 * - Dashboard link (always present; role-based nav added in Phase 2)
 * - Current role label (Phase 2 implements conditional nav items)
 * - Bottom: ThemeToggle and gear icon linking to /settings
 *
 * Gear icon is always one click away from anywhere in the app.
 */
import { Link } from 'react-router-dom';
import { Settings, LayoutDashboard } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';

const ROLE_LABELS: Record<string, string> = {
  developer: 'Developer',
  pm: 'Project Manager',
};

export default function Sidebar() {
  const { role } = useSettingsStore();

  return (
    <aside className="flex flex-col h-full w-16 md:w-56 border-r border-border bg-background shrink-0">
      {/* App name / logo */}
      <div className="px-4 py-5 border-b border-border">
        <span className="font-bold text-lg hidden md:block">Taskflow</span>
        <span className="font-bold text-lg md:hidden">TF</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Dashboard</span>
        </Link>

        {/* Role label placeholder — Phase 2 adds role-conditional nav items */}
        {role && (
          <div className="mt-4 px-3">
            <p className="text-xs text-muted-foreground hidden md:block">
              {ROLE_LABELS[role] ?? role}
            </p>
          </div>
        )}
      </nav>

      {/* Bottom: Settings link */}
      <div className="px-2 py-4 border-t border-border flex flex-col gap-1">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
