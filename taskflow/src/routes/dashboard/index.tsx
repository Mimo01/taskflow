/**
 * Dashboard -- widget-based overview page powered by react-grid-layout.
 *
 * Reads widget layout from settings store and renders a WidgetGrid.
 * Each widget manages its own data fetching and token loading internally.
 * Users can add, remove, drag, and resize widgets.
 */

import { useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import WidgetGrid from './WidgetGrid';
import WidgetPicker from './WidgetPicker';

export default function Dashboard() {
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
  const dashboardLayout = useSettingsStore((s) => s.dashboardLayout);
  const setDashboardLayout = useSettingsStore((s) => s.setDashboardLayout);
  const addDashboardWidget = useSettingsStore((s) => s.addDashboardWidget);
  const removeDashboardWidget = useSettingsStore((s) => s.removeDashboardWidget);
  const { activeJiraProject } = useAuthStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const queryClient = useQueryClient();

  // Track last-refreshed time by subscribing to the my-tasks query (shared cache with SubtasksPanel)
  const [updatedAt, setUpdatedAt] = useState<number>(
    () =>
      queryClient.getQueryState(['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey])
        ?.dataUpdatedAt ?? 0,
  );
  useEffect(() => {
    return queryClient.getQueryCache().subscribe(() => {
      const ts = queryClient.getQueryState([
        'jira-issues',
        'my-tasks',
        activeJiraProject,
        storyPointsFieldKey,
      ])?.dataUpdatedAt;
      if (ts) setUpdatedAt(ts);
    });
  }, [queryClient, activeJiraProject, storyPointsFieldKey]);
  const lastRefreshed = updatedAt
    ? `Refreshed: ${new Date(updatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  function handleRefresh() {
    queryClient.invalidateQueries();
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Overview</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{lastRefreshed}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="size-3" />
            Refresh
          </button>
          <WidgetPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onAddWidget={(type) => addDashboardWidget(type)}
          />
        </div>
      </div>

      {/* Body */}
      {dashboardLayout.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Your dashboard is empty"
          subtitle="Add widgets to build your personalized workspace."
          action={
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              Add Widget
            </Button>
          }
        />
      ) : (
        <WidgetGrid
          layout={dashboardLayout}
          onLayoutChange={(newLayout) => setDashboardLayout(newLayout)}
          onRemoveWidget={(id) => removeDashboardWidget(id)}
        />
      )}
    </div>
  );
}
