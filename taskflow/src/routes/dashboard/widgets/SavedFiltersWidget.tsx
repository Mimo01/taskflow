/**
 * SavedFiltersWidget -- quick-access Jira saved filters for the widget grid.
 *
 * Reads saved filters from useSavedFilterStore (synced from Jira favourite filters).
 * Each filter is a clickable item that activates the filter and navigates to the sprint board.
 */

import { Bookmark, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSavedFilterStore } from '@/stores/saved-filter.store';

export default function SavedFiltersWidget(_props: { widgetId: string }) {
  const savedFilters = useSavedFilterStore((s) => s.savedFilters);
  const setActiveFilter = useSavedFilterStore((s) => s.setActiveFilter);
  const navigate = useNavigate();

  if (savedFilters.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Filter className="size-5" />
          <span className="text-sm">No saved filters yet</span>
          <span className="text-xs text-center">Save a filter from the board to see it here.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 overflow-auto">
      {savedFilters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => {
            setActiveFilter(filter.id);
            navigate('/');
          }}
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm text-left w-full transition-colors"
        >
          <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{filter.name}</span>
        </button>
      ))}
    </div>
  );
}
