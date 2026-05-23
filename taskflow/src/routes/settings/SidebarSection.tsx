/**
 * SidebarSection -- Dedicated settings section for sidebar customization.
 *
 * Shows sidebar item visibility toggles grouped by section.
 */

import SidebarItemsList from './SidebarItemsList';

export default function SidebarSection() {
  return (
    <div data-testid="section-sidebar" className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Sidebar</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which navigation items appear in the sidebar.
        </p>
      </div>
      <SidebarItemsList />
    </div>
  );
}
