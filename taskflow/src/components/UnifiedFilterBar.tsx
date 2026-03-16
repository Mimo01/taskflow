/**
 * UnifiedFilterBar — Shared filter bar for backlog and sprint board views.
 *
 * Renders three multi-select comboboxes (Epic, Label, Assignee), active filter
 * chips, quickfilter pills with save/apply/delete, and a clear-all button.
 *
 * Filter state is read from the shared filter store (useFilterStore).
 * Quickfilter persistence is handled by the settings store.
 */

import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { useFilterStore } from '@/stores/filter.store'
import { useSettingsStore } from '@/stores/settings.store'
import type { QuickFilter } from '@/stores/filter.store'

// ── MultiFilterCombobox ──────────────────────────────────────────────────────

interface MultiFilterComboboxProps {
  id: string
  label: string
  placeholder: string
  noun: string
  options: string[]
  selected: Set<string>
  onToggle: (value: string) => void
}

function MultiFilterCombobox({
  id,
  label,
  placeholder,
  noun,
  options,
  selected,
  onToggle,
}: MultiFilterComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered = options.filter(
    (o) => !query || o.toLowerCase().includes(query.toLowerCase()),
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setOpen(true)
  }

  function handleFocus() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }

  const handleBlur = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }, [])

  function handleSelect(option: string) {
    onToggle(option)
    setQuery('')
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        value={query}
        placeholder={
          selected.size > 0
            ? `${selected.size} ${noun}${selected.size > 1 ? 's' : ''}`
            : placeholder
        }
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-32"
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-max min-w-full max-h-48 overflow-y-auto rounded border border-border bg-background shadow-md"
        >
          {filtered.map((option) => (
            <li key={option} role="option" aria-selected={selected.has(option)}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent flex items-center gap-2"
                onMouseDown={() => handleSelect(option)}
              >
                <span className="w-3 shrink-0">
                  {selected.has(option) ? '\u2713' : ''}
                </span>
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── UnifiedFilterBar ────────────────────────────────────────────────────────

export interface UnifiedFilterBarProps {
  filterOptions: {
    epics: Map<string, string> // epicKey -> epicName
    labels: string[]
    assignees: string[]
  }
}

export function UnifiedFilterBar({ filterOptions }: UnifiedFilterBarProps) {
  const {
    activeEpics,
    activeLabels,
    activeAssignees,
    toggleEpic,
    toggleLabel,
    toggleAssignee,
    clearAll,
    applyQuickFilter,
  } = useFilterStore()

  const { quickFilters, addQuickFilter, removeQuickFilter } =
    useSettingsStore()

  const [savingName, setSavingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const epicNames = Array.from(filterOptions.epics.values())
  const hasActiveFilters =
    activeEpics.size > 0 || activeLabels.size > 0 || activeAssignees.size > 0

  function handleSaveQuickFilter() {
    if (!nameInput.trim()) return
    const qf: QuickFilter = {
      id: Date.now().toString(),
      name: nameInput.trim(),
      epics: Array.from(activeEpics),
      labels: Array.from(activeLabels),
      assignees: Array.from(activeAssignees),
    }
    addQuickFilter(qf)
    setNameInput('')
    setSavingName(false)
  }

  function handleStartSave() {
    setSavingName(true)
    // Focus input on next tick
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  return (
    <div data-testid="unified-filter-bar" className="border-b">
      {/* Filter inputs + chips row */}
      <div className="flex flex-wrap gap-2 items-center px-4 py-2">
        <MultiFilterCombobox
          id="epic-filter"
          label="Epic"
          placeholder="Epic"
          noun="epic"
          options={epicNames}
          selected={activeEpics}
          onToggle={toggleEpic}
        />

        <MultiFilterCombobox
          id="label-filter"
          label="Label"
          placeholder="Label"
          noun="label"
          options={filterOptions.labels}
          selected={activeLabels}
          onToggle={toggleLabel}
        />

        <MultiFilterCombobox
          id="assignee-filter"
          label="Assignee"
          placeholder="Assignee"
          noun="assignee"
          options={filterOptions.assignees}
          selected={activeAssignees}
          onToggle={toggleAssignee}
        />

        {/* Active filter chips */}
        {Array.from(activeEpics).map((epic) => (
          <span
            key={`epic-${epic}`}
            data-testid={`epic-chip-${epic}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
          >
            {epic}
            <button
              type="button"
              aria-label="Clear epic filter"
              onClick={() => toggleEpic(epic)}
              className="ml-0.5 hover:text-destructive transition-colors"
            >
              ×
            </button>
          </span>
        ))}

        {Array.from(activeLabels).map((label) => (
          <span
            key={`label-${label}`}
            data-testid={`label-chip-${label}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
          >
            {label}
            <button
              type="button"
              aria-label={`Remove label ${label}`}
              onClick={() => toggleLabel(label)}
              className="ml-0.5 hover:text-destructive transition-colors"
            >
              ×
            </button>
          </span>
        ))}

        {Array.from(activeAssignees).map((assignee) => (
          <span
            key={`assignee-${assignee}`}
            data-testid={`assignee-chip-${assignee}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
          >
            {assignee}
            <button
              type="button"
              aria-label="Clear assignee filter"
              onClick={() => toggleAssignee(assignee)}
              className="ml-0.5 hover:text-destructive transition-colors"
            >
              ×
            </button>
          </span>
        ))}

        {/* Clear all button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Quickfilter row */}
      {(quickFilters.length > 0 || hasActiveFilters) && (
        <div className="flex flex-wrap gap-1.5 items-center px-4 py-1.5 bg-muted/20">
          {/* Saved quickfilter pills */}
          {quickFilters.map((qf) => (
            <span
              key={qf.id}
              className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => applyQuickFilter(qf)}
                className="hover:underline"
              >
                {qf.name}
              </button>
              <button
                type="button"
                aria-label={`Delete quickfilter ${qf.name}`}
                onClick={() => removeQuickFilter(qf.id)}
                className="hover:text-destructive transition-colors"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          {/* Save quickfilter */}
          {hasActiveFilters && !savingName && (
            <button
              type="button"
              onClick={handleStartSave}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Save filter
            </button>
          )}

          {savingName && (
            <span className="inline-flex items-center gap-1">
              <input
                ref={nameInputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveQuickFilter()
                  if (e.key === 'Escape') {
                    setSavingName(false)
                    setNameInput('')
                  }
                }}
                placeholder="Filter name..."
                className="rounded border border-border bg-background px-2 py-0.5 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleSaveQuickFilter}
                disabled={!nameInput.trim()}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavingName(false)
                  setNameInput('')
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default UnifiedFilterBar
