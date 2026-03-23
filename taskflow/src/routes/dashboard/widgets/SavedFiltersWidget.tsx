/**
 * SavedFiltersWidget -- quick-access filter shortcuts for the widget grid.
 *
 * Reads saved quickfilter presets from settings store (no token loading needed).
 * Each filter is a clickable item that navigates to the sprint board with that filter applied.
 */

import { Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFilterStore } from '@/stores/filter.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function SavedFiltersWidget(_props: { widgetId: string }) {
  const quickFilters = useSettingsStore((s) => s.quickFilters);
  const applyQuickFilter = useFilterStore((s) => s.applyQuickFilter);
  const navigate = useNavigate();

  if (quickFilters.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Filter className="size-5" />
          <span className="text-sm">No saved filters</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 overflow-auto">
      {quickFilters.map((qf) => (
        <button
          key={qf.id}
          type="button"
          onClick={() => {
            applyQuickFilter(qf);
            navigate('/');
          }}
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm text-left w-full transition-colors"
        >
          <Filter className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{qf.name}</span>
        </button>
      ))}
    </div>
  );
}
