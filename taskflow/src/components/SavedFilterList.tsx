/**
 * SavedFilterList -- sidebar section listing favourite Jira filters with
 * click-to-apply, context menu for edit/delete, and collapsible section.
 *
 * Reads from useSavedFilterStore. Edit/delete operations call Jira API
 * then update the store.
 */

import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { EditFilterDialog } from '@/components/EditFilterDialog';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteJiraFilter, updateJiraFilter } from '@/services/jira/filters';
import type { JiraSavedFilter } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSavedFilterStore } from '@/stores/saved-filter.store';

export interface SavedFilterListProps {
  onApplyFilter: (filter: JiraSavedFilter) => void;
}

export function SavedFilterList({ onApplyFilter }: SavedFilterListProps) {
  const { savedFilters, activeFilterId, setActiveFilter, removeSavedFilter, updateSavedFilter } =
    useSavedFilterStore();
  const isLoading = useSavedFilterStore((s) => s.isLoading);
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);

  const [collapsed, setCollapsed] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<JiraSavedFilter | null>(null);
  const [deletingFilter, setDeletingFilter] = useState<JiraSavedFilter | null>(null);
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);

  function handleClickFilter(filter: JiraSavedFilter) {
    if (activeFilterId === filter.id) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filter.id);
      onApplyFilter(filter);
    }
  }

  function handleEditOpen(filter: JiraSavedFilter) {
    setEditingFilter(filter);
    setEditDialogOpen(true);
  }

  function handleDeleteOpen(filter: JiraSavedFilter) {
    setDeletingFilter(filter);
    setDeletePopoverOpen(true);
  }

  async function handleUpdate(filterId: string, name: string, jql: string, description: string) {
    if (!jiraBaseUrl) return;
    const token = await readSecret('jira-pat');
    const result = await updateJiraFilter(jiraBaseUrl, token, filterId, name, jql, description);
    updateSavedFilter(filterId, result);
  }

  async function handleDelete() {
    if (!jiraBaseUrl || !deletingFilter) return;
    const token = await readSecret('jira-pat');
    await deleteJiraFilter(jiraBaseUrl, token, deletingFilter.id);
    removeSavedFilter(deletingFilter.id);
    setDeletePopoverOpen(false);
    setDeletingFilter(null);
  }

  return (
    <div className="px-2 py-1">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-1.5 px-1 py-1 text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
        <Bookmark className="size-3.5" />
        Saved Filters
      </button>

      {!collapsed && (
        <div role="listbox" aria-label="Saved Filters" className="mt-1 space-y-0.5">
          {/* Loading state */}
          {isLoading && (
            <>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </>
          )}

          {/* Empty state */}
          {!isLoading && savedFilters.length === 0 && (
            <div className="px-2 py-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">No saved filters</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Save your current search to quickly reuse it later.
              </p>
            </div>
          )}

          {/* Filter items */}
          {!isLoading &&
            savedFilters.map((filter) => {
              const isActive = activeFilterId === filter.id;
              return (
                <ContextMenu key={filter.id}>
                  <ContextMenuTrigger
                    render={
                      <button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleClickFilter(filter)}
                        className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left cursor-pointer ${
                          isActive
                            ? 'bg-primary/10 text-foreground font-semibold'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      />
                    }
                  >
                    <Bookmark
                      className={`size-3.5 shrink-0 ${isActive ? 'fill-primary/40 text-primary' : ''}`}
                    />
                    <span className="truncate max-w-[150px]">{filter.name}</span>
                    {isActive && <Check className="size-3.5 ml-auto shrink-0 text-primary" />}
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleEditOpen(filter)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => handleDeleteOpen(filter)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete Filter
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
        </div>
      )}

      {/* Delete confirmation popover */}
      {deletingFilter && (
        <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
          <PopoverTrigger render={<span className="hidden" />} />
          <PopoverContent className="w-72 p-4">
            <p className="text-sm text-foreground mb-3">
              Delete filter: Remove &quot;{deletingFilter.name}&quot;? This will also delete it from
              Jira.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setDeletePopoverOpen(false);
                  setDeletingFilter(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" size="xs" onClick={handleDelete}>
                Delete Filter
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Edit dialog */}
      <EditFilterDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        filter={editingFilter}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
