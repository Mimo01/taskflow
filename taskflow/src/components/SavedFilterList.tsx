/**
 * SavedFilterList -- Collapsible sidebar section listing Jira saved filters.
 *
 * Renders filter items with active highlight, click-to-toggle, right-click
 * context menu (edit/delete), and inline delete confirmation. Manages the
 * EditFilterDialog for editing filters.
 */

import { Bookmark, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { deleteJiraFilter } from '@/services/jira/filters';
import type { JiraSavedFilter } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { useSavedFilterStore } from '@/stores/saved-filter.store';
import { EditFilterDialog } from './EditFilterDialog';

interface SavedFilterListProps {
  jiraBaseUrl: string;
}

export function SavedFilterList({ jiraBaseUrl }: SavedFilterListProps) {
  const savedFilters = useSavedFilterStore((s) => s.savedFilters);
  const activeFilterId = useSavedFilterStore((s) => s.activeFilterId);
  const setActiveFilter = useSavedFilterStore((s) => s.setActiveFilter);
  const removeSavedFilter = useSavedFilterStore((s) => s.removeSavedFilter);

  const [expanded, setExpanded] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<JiraSavedFilter | null>(null);
  const [deletingFilter, setDeletingFilter] = useState<JiraSavedFilter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleFilterClick(filterId: string) {
    if (activeFilterId === filterId) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filterId);
    }
  }

  function handleEditClick(filter: JiraSavedFilter) {
    setEditingFilter(filter);
    setEditDialogOpen(true);
  }

  function handleDeleteClick(filter: JiraSavedFilter) {
    setDeletingFilter(filter);
  }

  async function handleDeleteConfirm() {
    if (!deletingFilter || isDeleting) return;

    setIsDeleting(true);
    try {
      const token = await readSecret('jira-pat');
      await deleteJiraFilter(jiraBaseUrl, token, deletingFilter.id);
      removeSavedFilter(deletingFilter.id);
      setDeletingFilter(null);
    } catch {
      // Keep confirmation open so user can retry
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div data-testid="saved-filter-list">
      {/* Section header */}
      <button
        type="button"
        className="flex w-full items-center gap-1 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        Saved Filters
      </button>

      {expanded && (
        <div className="px-1">
          {savedFilters.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No saved filters</p>
          ) : (
            savedFilters.map((filter) => {
              const isActive = activeFilterId === filter.id;

              // Show delete confirmation inline for this filter
              if (deletingFilter?.id === filter.id) {
                return (
                  <div
                    key={filter.id}
                    className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs"
                  >
                    <p className="mb-2">
                      Delete <strong>{filter.name}</strong>? This removes it from Jira. This cannot
                      be undone.
                    </p>
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setDeletingFilter(null)}
                        disabled={isDeleting}
                      >
                        Keep Filter
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete Filter'}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <ContextMenu key={filter.id}>
                  <ContextMenuTrigger className="block w-full">
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'hover:bg-sidebar-accent/50'
                      }`}
                      onClick={() => handleFilterClick(filter.id)}
                    >
                      <Bookmark className="size-3.5 shrink-0" />
                      <span className="truncate">{filter.name}</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleEditClick(filter)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => handleDeleteClick(filter)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })
          )}
        </div>
      )}

      <EditFilterDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        filter={editingFilter}
        jiraBaseUrl={jiraBaseUrl}
      />
    </div>
  );
}
