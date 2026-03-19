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

import { useCallback, useRef, useState } from 'react';

// ─── MultiFilterCombobox ───────────────────────────────────────────────────────

interface MultiFilterComboboxProps {
  id: string;
  label: string;
  placeholder: string;
  noun: string; // singular noun for the count chip e.g. "epic", "assignee", "label"
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
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
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = options.filter((o) => !query || o.toLowerCase().includes(query.toLowerCase()));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleFocus() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  const handleBlur = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  function handleSelect(option: string) {
    onToggle(option);
    setQuery('');
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
        <ul className="absolute z-20 mt-1 w-max min-w-full max-h-48 overflow-y-auto rounded border border-border bg-background shadow-md">
          {filtered.map((option) => (
            <li key={option} aria-selected={selected.has(option)}>
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
  );
}

// ─── BacklogFilterBar ──────────────────────────────────────────────────────────

export interface BacklogFilterBarProps {
  filterOptions: {
    epics: Map<string, string>; // epicKey → epicName
    labels: string[];
    assignees: string[];
  };
  activeEpics: Set<string>;
  activeLabels: Set<string>;
  activeAssignees: Set<string>;
  onEpicsChange: (epics: Set<string>) => void;
  onLabelsChange: (labels: Set<string>) => void;
  onAssigneesChange: (assignees: Set<string>) => void;
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function BacklogFilterBar({
  filterOptions,
  activeEpics,
  activeLabels,
  activeAssignees,
  onEpicsChange,
  onLabelsChange,
  onAssigneesChange,
}: BacklogFilterBarProps) {
  const epicNames = Array.from(filterOptions.epics.values());

  return (
    <div data-testid="filter-bar" className="flex flex-wrap gap-2 items-center px-4 py-2 border-b">
      <MultiFilterCombobox
        id="epic-filter"
        label="Epic"
        placeholder="Epic"
        noun="epic"
        options={epicNames}
        selected={activeEpics}
        onToggle={(name) => onEpicsChange(toggle(activeEpics, name))}
      />

      <MultiFilterCombobox
        id="label-filter"
        label="Label"
        placeholder="Label"
        noun="label"
        options={filterOptions.labels}
        selected={activeLabels}
        onToggle={(label) => onLabelsChange(toggle(activeLabels, label))}
      />

      <MultiFilterCombobox
        id="assignee-filter"
        label="Assignee"
        placeholder="Assignee"
        noun="assignee"
        options={filterOptions.assignees}
        selected={activeAssignees}
        onToggle={(name) => onAssigneesChange(toggle(activeAssignees, name))}
      />

      {/* Active filter chips */}

      {Array.from(activeEpics).map((epic) => (
        <span
          key={epic}
          data-testid={`epic-chip-${epic}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
        >
          {epic}
          <button
            type="button"
            aria-label={`Clear epic filter`}
            onClick={() => onEpicsChange(toggle(activeEpics, epic))}
            className="ml-0.5 hover:text-destructive transition-colors"
          >
            ×
          </button>
        </span>
      ))}

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
            onClick={() => onLabelsChange(toggle(activeLabels, label))}
            className="ml-0.5 hover:text-destructive transition-colors"
          >
            ×
          </button>
        </span>
      ))}

      {Array.from(activeAssignees).map((assignee) => (
        <span
          key={assignee}
          data-testid={`assignee-chip-${assignee}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
        >
          {assignee}
          <button
            type="button"
            aria-label={`Clear assignee filter`}
            onClick={() => onAssigneesChange(toggle(activeAssignees, assignee))}
            className="ml-0.5 hover:text-destructive transition-colors"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export default BacklogFilterBar;
