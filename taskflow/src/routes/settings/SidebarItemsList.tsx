/**
 * SidebarItemsList -- Visibility-only checkbox list for sidebar item visibility.
 *
 * Groups items by section with non-interactive section headers.
 * Each item can be toggled visible/hidden via a checkbox.
 */

import { SIDEBAR_NAV_ITEMS, SIDEBAR_SECTIONS } from '@/components/app/sidebar-items';
import { useSettingsStore } from '@/stores/settings.store';

export default function SidebarItemsList() {
  const { sidebarItems, setSidebarItemVisible } = useSettingsStore();

  // Build a lookup: id -> visible (default true when missing)
  const visibilityMap = new Map(sidebarItems.map((item) => [item.id, item.visible]));

  return (
    <div className="flex flex-col gap-4">
      {SIDEBAR_SECTIONS.map((section) => {
        const sectionItems = SIDEBAR_NAV_ITEMS.filter((nav) => nav.section === section.id);
        if (sectionItems.length === 0) return null;

        return (
          <div key={section.id} className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {section.label}
            </span>
            {sectionItems.map((nav) => {
              const isVisible = visibilityMap.get(nav.id) ?? true;
              return (
                <label
                  key={nav.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={nav.alwaysVisible ? true : isVisible}
                    disabled={nav.alwaysVisible}
                    onChange={(e) =>
                      nav.alwaysVisible
                        ? undefined
                        : setSidebarItemVisible(nav.id, e.target.checked)
                    }
                    className="h-4 w-4 rounded border-border accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm">{nav.label}</span>
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
