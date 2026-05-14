/**
 * Settings — Two-column sidebar-nav shell.
 *
 * Renders a persistent sidebar with 5 sections. Content area swaps
 * based on activeSection state (no React Router sub-routes).
 *
 * Section files:
 *   - ConnectionsSection: Plan 18-03 (this plan)
 *   - AppearanceSection: stub → Plan 18-04
 *   - NotificationsSection: stub → Plan 18-05
 *   - WorkflowSection: stub → Plan 18-05
 *   - RoleSection: existing, unchanged
 */

import {
  Bell,
  GitBranch,
  Link2,
  Palette,
  PanelLeft,
  Plug,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import AppearanceSection from './AppearanceSection';
import ConnectionsSection from './ConnectionsSection';
import DebugModeSection from './DebugModeSection';
import IntegrationsSection from './IntegrationsSection';
import NotificationsSection from './NotificationsSection';
import SidebarSection from './SidebarSection';
import UpdatesSection from './UpdatesSection';
import WorkflowSection from './WorkflowSection';

type SettingsSection =
  | 'connections'
  | 'appearance'
  | 'sidebar'
  | 'notifications'
  | 'workflow'
  | 'integrations'
  | 'updates'
  | 'advanced';

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'connections', label: 'Connections', icon: <Link2 className="h-4 w-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" /> },
  { id: 'sidebar', label: 'Sidebar', icon: <PanelLeft className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'workflow', label: 'Workflow', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <Plug className="h-4 w-4" /> },
  { id: 'updates', label: 'Updates', icon: <RefreshCw className="h-4 w-4" /> },
  { id: 'advanced', label: 'Advanced', icon: <Settings2 className="h-4 w-4" /> },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('connections');

  return (
    <div className="flex h-full min-h-0">
      <nav
        aria-label="Settings navigation"
        className="w-52 shrink-0 border-r border-border flex flex-col gap-0.5 px-2 py-6 overflow-y-auto"
      >
        {SECTIONS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            aria-current={activeSection === id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-left',
              activeSection === id
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-auto py-8 px-6 max-w-2xl">
        {activeSection === 'connections' && (
          <div data-testid="section-connections">
            <ConnectionsSection />
          </div>
        )}
        {activeSection === 'appearance' && <AppearanceSection />}
        {activeSection === 'sidebar' && <SidebarSection />}
        {activeSection === 'notifications' && <NotificationsSection />}
        {activeSection === 'workflow' && <WorkflowSection />}
        {activeSection === 'integrations' && <IntegrationsSection />}
        {activeSection === 'updates' && <UpdatesSection />}
        {activeSection === 'advanced' && <DebugModeSection />}
      </div>
    </div>
  );
}
