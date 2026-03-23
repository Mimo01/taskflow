/**
 * Sidebar -- App sidebar with data-driven navigation links.
 *
 * Layout: vertical sidebar. Contains:
 * - App name/logo at top
 * - Data-driven nav links from sidebarItems[] in settings store
 * - Bottom: Dev Tools (when enabled) + Settings link (always pinned)
 *
 * Gear icon is always one click away from anywhere in the app.
 */

import {
  Bug,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settings.store';
import { SIDEBAR_NAV_ITEMS, type SidebarNavDef } from '@/components/app/sidebar-items';
import AppIcon from './AppIcon';

const NAV_LINK_BASE =
  'flex items-center py-2 density-compact:py-1 density-comfortable:py-3 rounded-lg text-sm font-medium transition-colors';
function navLinkClassFn(collapsed: boolean) {
  const base = collapsed ? `${NAV_LINK_BASE} justify-center px-2` : `${NAV_LINK_BASE} gap-3 px-3`;
  return ({ isActive }: { isActive: boolean }) =>
    isActive ? `${base} bg-accent text-accent-foreground font-semibold` : `${base} hover:bg-accent`;
}

export default function Sidebar() {
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);
  const sidebarItems = useSettingsStore((s) => s.sidebarItems);
  const [hovered, setHovered] = useState(false);

  const navLinkClass = navLinkClassFn(sidebarCollapsed);
  const labelClass = sidebarCollapsed ? 'hidden' : 'hidden md:block';

  // Merge stored order/visibility with static definitions
  const visibleNavItems = sidebarItems
    .filter(item => item.visible)
    .map(item => SIDEBAR_NAV_ITEMS.find(def => def.id === item.id))
    .filter((def): def is SidebarNavDef => def != null);

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

      {/* Nav links -- data-driven from sidebarItems store */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-4 flex flex-col gap-1">
        {visibleNavItems.map(def => (
          <NavLink
            key={def.id}
            to={def.path}
            className={navLinkClass}
            title={sidebarCollapsed ? def.label : undefined}
          >
            <def.icon className="h-4 w-4 shrink-0" />
            <span className={labelClass}>{def.label}</span>
          </NavLink>
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
