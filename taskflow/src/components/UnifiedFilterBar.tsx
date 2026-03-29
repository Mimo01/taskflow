/**
 * UnifiedFilterBar — Shared filter bar for backlog and sprint board views.
 *
 * Popover-based multi-select filter dropdowns with active filter chips,
 * quickfilter presets, and a save flow. Uses the design system's Popover,
 * Button, and Badge components for visual consistency.
 */

import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Info,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { SaveFilterDialog } from '@/components/SaveFilterDialog';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuthStore } from '@/stores/auth.store';
import type { QuickFilter } from '@/stores/filter.store';
import { useFilterStore } from '@/stores/filter.store';
import { useSettingsStore } from '@/stores/settings.store';

// ── FilterDropdown ──────────────────────────────────────────────────────────

interface FilterDropdownProps {
  label: string;
  icon?: React.ReactNode;
  /** Values to toggle. For epics, these are keys; for others, display strings. */
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  /** Optional map from value → display name (e.g. epicKey → epicName). */
  displayMap?: Map<string, string>;
  colorDot?: (value: string) => string | undefined;
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  displayMap,
  colorDot,
}: FilterDropdownProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const display = (value: string) => displayMap?.get(value) ?? value;

  const filtered = !query
    ? options
    : (() => {
        const q = query.toLowerCase();
        return options.filter((o) => display(o).toLowerCase().includes(q));
      })();

  const count = selected.size;

  return (
    <Popover>
      <PopoverTrigger render={<Button variant={count > 0 ? 'secondary' : 'outline'} size="xs" />}>
        {label}
        {count > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-none">
            {count}
          </span>
        )}
        <ChevronDown className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Options list */}
        <div className="max-h-52 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
          ) : (
            filtered.map((option) => {
              const isSelected = selected.has(option);
              const dot = colorDot?.(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onToggle(option)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                >
                  <span
                    className={`flex items-center justify-center size-4 rounded border shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border'
                    }`}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                  {dot && (
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dot }}
                    />
                  )}
                  <span className="truncate">{display(option)}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer: clear selection */}
        {count > 0 && (
          <div className="border-t border-border px-3 py-1.5">
            <button
              type="button"
              onClick={() => {
                selected.forEach((v) => {
                  onToggle(v);
                });
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear {label.toLowerCase()}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── UnifiedFilterBar ────────────────────────────────────────────────────────

export interface UnifiedFilterBarProps {
  filterOptions: {
    epics: Map<string, string>;
    labels: string[];
    assignees: string[];
    statuses: string[];
    epicColors?: Map<string, string>;
  };
}

export function UnifiedFilterBar({ filterOptions }: UnifiedFilterBarProps) {
  const {
    activeEpics,
    activeLabels,
    activeAssignees,
    activeStatuses,
    toggleEpic,
    toggleLabel,
    toggleAssignee,
    toggleStatus,
    clearAll,
    applyQuickFilter,
  } = useFilterStore();

  const { quickFilters, addQuickFilter, removeQuickFilter, renameQuickFilter, moveQuickFilter } =
    useSettingsStore();

  const { jiraBaseUrl } = useAuthStore();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const [savingName, setSavingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const epicKeys = Array.from(filterOptions.epics.keys());
  const hasActiveFilters =
    activeEpics.size > 0 ||
    activeLabels.size > 0 ||
    activeAssignees.size > 0 ||
    activeStatuses.size > 0;

  const activeCount =
    activeEpics.size + activeLabels.size + activeAssignees.size + activeStatuses.size;

  const currentJqlClauses: string[] = [];
  if (activeEpics.size > 0) {
    currentJqlClauses.push(`"Epic Link" in (${Array.from(activeEpics).join(', ')})`);
  }
  if (activeLabels.size > 0) {
    currentJqlClauses.push(
      `labels in (${Array.from(activeLabels)
        .map((l) => `"${l}"`)
        .join(', ')})`,
    );
  }
  if (activeAssignees.size > 0) {
    currentJqlClauses.push(
      `assignee in (${Array.from(activeAssignees)
        .map((a) => `"${a}"`)
        .join(', ')})`,
    );
  }
  if (activeStatuses.size > 0) {
    currentJqlClauses.push(
      `status in (${Array.from(activeStatuses)
        .map((s) => `"${s}"`)
        .join(', ')})`,
    );
  }
  const currentJql = currentJqlClauses.join(' AND ');

  function handleSaveQuickFilter() {
    if (!nameInput.trim()) return;
    const qf: QuickFilter = {
      id: Date.now().toString(),
      name: nameInput.trim(),
      epics: Array.from(activeEpics),
      labels: Array.from(activeLabels),
      assignees: Array.from(activeAssignees),
      statuses: Array.from(activeStatuses),
    };
    addQuickFilter(qf);
    setNameInput('');
    setSavingName(false);
  }

  function handleStartSave() {
    setSavingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  // Check if a quickfilter matches the current active filters
  function isQuickFilterActive(qf: QuickFilter): boolean {
    const epicMatch =
      qf.epics.length === activeEpics.size && qf.epics.every((e) => activeEpics.has(e));
    const labelMatch =
      qf.labels.length === activeLabels.size && qf.labels.every((l) => activeLabels.has(l));
    const assigneeMatch =
      qf.assignees.length === activeAssignees.size &&
      qf.assignees.every((a) => activeAssignees.has(a));
    const statusMatch =
      (qf.statuses ?? []).length === activeStatuses.size &&
      (qf.statuses ?? []).every((s) => activeStatuses.has(s));
    return epicMatch && labelMatch && assigneeMatch && statusMatch;
  }

  // Collect all active chips in one flat list with category labels
  const activeChips: Array<{
    key: string;
    label: string;
    category: string;
    onRemove: () => void;
  }> = [];

  activeEpics.forEach((epicKey) => {
    activeChips.push({
      key: `epic-${epicKey}`,
      label: filterOptions.epics.get(epicKey) ?? epicKey,
      category: 'Epic',
      onRemove: () => toggleEpic(epicKey),
    });
  });
  activeLabels.forEach((label) => {
    activeChips.push({
      key: `label-${label}`,
      label,
      category: 'Label',
      onRemove: () => toggleLabel(label),
    });
  });
  activeAssignees.forEach((assignee) => {
    activeChips.push({
      key: `assignee-${assignee}`,
      label: assignee,
      category: 'Assignee',
      onRemove: () => toggleAssignee(assignee),
    });
  });
  activeStatuses.forEach((status) => {
    activeChips.push({
      key: `status-${status}`,
      label: status,
      category: 'Status',
      onRemove: () => toggleStatus(status),
    });
  });

  const [filtersOpen, setFiltersOpen] = useState(false);

  // Auto-open selectors when there are active filters but no quickfilters yet
  // (so user can see what's active and save it)

  return (
    <div data-testid="unified-filter-bar" className="border-b border-border">
      {/* Primary row: quickfilters + filter toggle */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        {/* Quickfilter presets */}
        {/* Empty state hint */}
        {quickFilters.length === 0 && !hasActiveFilters && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 italic">
            <Info className="size-3 shrink-0" />
            Saved filters appear here — use Filter to create one
          </span>
        )}

        {quickFilters.map((qf, qfIndex) => {
          const active = isQuickFilterActive(qf);
          const isFirst = qfIndex === 0;
          const isLast = qfIndex === quickFilters.length - 1;
          const isRenaming = renamingId === qf.id;

          if (isRenaming) {
            return (
              <span
                key={qf.id}
                className="inline-flex items-center gap-1 rounded-md border border-ring bg-background pl-1.5 pr-1 py-0.5"
              >
                <Bookmark className="size-3 shrink-0 text-muted-foreground" />
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameInput.trim()) {
                      renameQuickFilter(qf.id, renameInput.trim());
                      setRenamingId(null);
                    }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => {
                    if (renameInput.trim()) renameQuickFilter(qf.id, renameInput.trim());
                    setRenamingId(null);
                  }}
                  className="bg-transparent text-xs w-24 outline-none"
                />
              </span>
            );
          }

          return (
            <ContextMenu key={qf.id}>
              <ContextMenuTrigger
                render={
                  <button
                    type="button"
                    onClick={() => (active ? clearAll() : applyQuickFilter(qf))}
                    className={`inline-flex items-center gap-1 rounded-md text-xs leading-tight pl-2 pr-2.5 py-1 transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                    }`}
                  />
                }
              >
                <Bookmark className={`size-3 shrink-0 ${active ? 'fill-primary/40' : ''}`} />
                <span className="truncate max-w-[120px]">{qf.name}</span>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => {
                    setRenamingId(qf.id);
                    setRenameInput(qf.name);
                    setTimeout(() => renameInputRef.current?.select(), 0);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Rename
                </ContextMenuItem>
                {quickFilters.length > 1 && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      disabled={isFirst}
                      onClick={() => moveQuickFilter(qf.id, 'left')}
                    >
                      <ArrowLeft className="size-3.5" />
                      Move left
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={isLast}
                      onClick={() => moveQuickFilter(qf.id, 'right')}
                    >
                      <ArrowRight className="size-3.5" />
                      Move right
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={isFirst}
                      onClick={() => moveQuickFilter(qf.id, 'front')}
                    >
                      <ChevronsLeft className="size-3.5" />
                      Move to front
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={isLast}
                      onClick={() => moveQuickFilter(qf.id, 'back')}
                    >
                      <ChevronsRight className="size-3.5" />
                      Move to back
                    </ContextMenuItem>
                  </>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={() => removeQuickFilter(qf.id)}>
                  <Trash2 className="size-3.5" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {/* Active filter chips (shown in primary row when selectors are closed) */}
        {!filtersOpen && activeChips.length > 0 && (
          <>
            {quickFilters.length > 0 && <div className="w-px h-4 bg-border" />}
            <div className="flex flex-wrap items-center gap-1">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  data-testid={`${chip.key.replace(/^(epic|label|assignee|status)-/, '$1-chip-')}`}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground pl-1.5 pr-1 py-0.5 text-[11px] leading-tight"
                >
                  <span className="text-muted-foreground font-medium">{chip.category}:</span>
                  <span className="max-w-[120px] truncate">{chip.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${chip.category.toLowerCase()} filter ${chip.label}`}
                    onClick={chip.onRemove}
                    className="rounded-sm hover:bg-muted-foreground/20 p-0.5 transition-colors"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
              >
                Clear
              </button>
            </div>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Save as quickfilter */}
        {hasActiveFilters && !savingName && (
          <Button
            variant="ghost"
            size="xs"
            onClick={handleStartSave}
            className="text-muted-foreground gap-1"
          >
            <BookmarkPlus className="size-3" />
            <span className="text-[11px]">Save</span>
          </Button>
        )}

        {/* Save to Jira as saved filter */}
        {hasActiveFilters && !savingName && jiraBaseUrl && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSaveDialogOpen(true)}
            className="text-muted-foreground gap-1"
          >
            <BookmarkPlus className="size-3" />
            <span className="text-[11px]">Save Filter</span>
          </Button>
        )}

        {savingName && (
          <span className="inline-flex items-center gap-1">
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveQuickFilter();
                if (e.key === 'Escape') {
                  setSavingName(false);
                  setNameInput('');
                }
              }}
              placeholder="Filter name..."
              className="h-6 rounded-md border border-border bg-background px-2 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              variant="default"
              size="xs"
              onClick={handleSaveQuickFilter}
              disabled={!nameInput.trim()}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSavingName(false);
                setNameInput('');
              }}
            >
              <X className="size-3" />
            </Button>
          </span>
        )}

        {/* Filter toggle button */}
        <Button
          variant={filtersOpen ? 'secondary' : 'outline'}
          size="xs"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="gap-1"
        >
          <Filter className="size-3" />
          Filter
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-none">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {/* Save Filter dialog (Jira) */}
      {jiraBaseUrl && (
        <SaveFilterDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          jql={currentJql}
          jiraBaseUrl={jiraBaseUrl}
        />
      )}

      {/* Expandable filter selectors row */}
      {filtersOpen && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-border/50 bg-muted/20">
          <FilterDropdown
            label="Epic"
            options={epicKeys}
            selected={activeEpics}
            onToggle={toggleEpic}
            displayMap={filterOptions.epics}
          />
          <FilterDropdown
            label="Label"
            options={filterOptions.labels}
            selected={activeLabels}
            onToggle={toggleLabel}
          />
          <FilterDropdown
            label="Assignee"
            options={filterOptions.assignees}
            selected={activeAssignees}
            onToggle={toggleAssignee}
          />
          <FilterDropdown
            label="Status"
            options={filterOptions.statuses}
            selected={activeStatuses}
            onToggle={toggleStatus}
          />

          {/* Active filter chips inline with selectors */}
          {activeChips.length > 0 && (
            <>
              <div className="w-px h-4 bg-border" />
              <div className="flex flex-wrap items-center gap-1">
                {activeChips.map((chip) => (
                  <span
                    key={chip.key}
                    data-testid={`${chip.key.replace(/^(epic|label|assignee|status)-/, '$1-chip-')}`}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground pl-1.5 pr-1 py-0.5 text-[11px] leading-tight"
                  >
                    <span className="text-muted-foreground font-medium">{chip.category}:</span>
                    <span className="max-w-[120px] truncate">{chip.label}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${chip.category.toLowerCase()} filter ${chip.label}`}
                      onClick={chip.onRemove}
                      className="rounded-sm hover:bg-muted-foreground/20 p-0.5 transition-colors"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
                >
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default UnifiedFilterBar;
