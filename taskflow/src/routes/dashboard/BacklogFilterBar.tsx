/**
 * BacklogFilterBar — Horizontal filter bar for the Backlog view.
 *
 * Provides fuzzy autocomplete comboboxes for Epic, Label, and Assignee.
 * Typing in any input immediately filters rows (substring match, case-insensitive).
 * Clicking a suggestion fills the input with the exact option label.
 * Active filters show as dismissible chips.
 *
 * All state lives in BacklogPage — this component is purely presentational.
 */

import { useState, useRef, useCallback } from 'react'

// ─── FilterCombobox ────────────────────────────────────────────────────────────

interface FilterComboboxProps {
  id: string
  label: string
  placeholder: string
  options: string[]
  value: string | null
  onSelect: (value: string | null) => void
}

function FilterCombobox({ id, label, placeholder, options, value, onSelect }: FilterComboboxProps) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query = value ?? ''
  const filtered = options.filter((o) =>
    !query || o.toLowerCase().includes(query.toLowerCase()),
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onSelect(e.target.value || null)
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
    onSelect(option)
    setOpen(false)
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
        placeholder={placeholder}
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
            <li key={option} role="option" aria-selected={value === option}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                onMouseDown={() => handleSelect(option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── MultiFilterCombobox ───────────────────────────────────────────────────────

interface MultiFilterComboboxProps {
  id: string
  label: string
  placeholder: string
  options: string[]
  selected: Set<string>
  onToggle: (value: string) => void
}

function MultiFilterCombobox({
  id,
  label,
  placeholder,
  options,
  selected,
  onToggle,
}: MultiFilterComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered = options.filter((o) =>
    !query || o.toLowerCase().includes(query.toLowerCase()),
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
        placeholder={selected.size > 0 ? `${selected.size} label${selected.size > 1 ? 's' : ''}` : placeholder}
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
                <span className="w-3 shrink-0">{selected.has(option) ? '✓' : ''}</span>
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── BacklogFilterBar ──────────────────────────────────────────────────────────

export interface BacklogFilterBarProps {
  filterOptions: {
    epics: Map<string, string> // epicKey → epicName
    labels: string[]
    assignees: string[]
  }
  activeEpic: string | null
  activeLabels: Set<string>
  activeAssignee: string | null
  onEpicChange: (epicQuery: string | null) => void
  onLabelsChange: (labels: Set<string>) => void
  onAssigneeChange: (assignee: string | null) => void
}

export function BacklogFilterBar({
  filterOptions,
  activeEpic,
  activeLabels,
  activeAssignee,
  onEpicChange,
  onLabelsChange,
  onAssigneeChange,
}: BacklogFilterBarProps) {
  const epicNames = Array.from(filterOptions.epics.values())

  return (
    <div
      data-testid="filter-bar"
      className="flex flex-wrap gap-2 items-center px-4 py-2 border-b"
    >
      <FilterCombobox
        id="epic-filter"
        label="Epic"
        placeholder="Epic"
        options={epicNames}
        value={activeEpic}
        onSelect={onEpicChange}
      />

      <MultiFilterCombobox
        id="label-filter"
        label="Label"
        placeholder="Label"
        options={filterOptions.labels}
        selected={activeLabels}
        onToggle={(label) => {
          const next = new Set(activeLabels)
          if (next.has(label)) next.delete(label)
          else next.add(label)
          onLabelsChange(next)
        }}
      />

      <FilterCombobox
        id="assignee-filter"
        label="Assignee"
        placeholder="Assignee"
        options={filterOptions.assignees}
        value={activeAssignee}
        onSelect={onAssigneeChange}
      />

      {/* Active filter chips */}

      {activeEpic && (
        <span
          data-testid={`epic-chip-${activeEpic}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
        >
          {activeEpic}
          <button
            type="button"
            data-testid="clear-epic-filter"
            aria-label="Clear epic filter"
            onClick={() => onEpicChange(null)}
            className="ml-0.5 hover:text-destructive transition-colors"
          >
            ×
          </button>
        </span>
      )}

      {Array.from(activeLabels).map((label) => (
        <span
          key={label}
          data-testid={`label-chip-${label}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
        >
          {label}
          <button
            type="button"
            aria-label={`Remove label ${label}`}
            onClick={() => {
              const next = new Set(activeLabels)
              next.delete(label)
              onLabelsChange(next)
            }}
            className="ml-0.5 hover:text-destructive transition-colors"
          >
            ×
          </button>
        </span>
      ))}

      {activeAssignee && (
        <span
          data-testid={`assignee-chip-${activeAssignee}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
        >
          {activeAssignee}
          <button
            type="button"
            data-testid="clear-assignee-filter"
            aria-label="Clear assignee filter"
            onClick={() => onAssigneeChange(null)}
            className="ml-0.5 hover:text-destructive transition-colors"
          >
            ×
          </button>
        </span>
      )}
    </div>
  )
}

export default BacklogFilterBar
