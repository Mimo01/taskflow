/**
 * BacklogFilterBar — Horizontal filter bar for the Backlog view.
 *
 * Provides three native <select> (combobox) dropdowns for Epic, Label, and Assignee.
 * Active filters are displayed as dismissible chips inline after the selects.
 *
 * All state lives in BacklogPage — this component is purely presentational.
 *
 * Using native <select> elements (role="combobox") for filter dropdowns so that
 * tests can use getByRole('combobox', { name: /epic/i }) + fireEvent.change().
 */

export interface BacklogFilterBarProps {
  filterOptions: {
    epics: Map<string, string>; // epicKey → epicName
    labels: string[];
    assignees: string[];
  };
  activeEpic: string | null;
  activeLabels: Set<string>;
  activeAssignee: string | null;
  onEpicChange: (epicKey: string | null) => void;
  onLabelsChange: (labels: Set<string>) => void;
  onAssigneeChange: (assignee: string | null) => void;
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
  const epicEntries = Array.from(filterOptions.epics.entries());

  return (
    <div
      data-testid="filter-bar"
      className="flex flex-wrap gap-2 items-center px-4 py-2 border-b"
    >
      {/* Epic filter */}
      <label htmlFor="epic-filter" className="sr-only">
        Epic
      </label>
      <select
        id="epic-filter"
        aria-label="Epic"
        value={activeEpic ?? ''}
        onChange={(e) => onEpicChange(e.target.value || null)}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All Epics</option>
        {epicEntries.map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>

      {/* Label filter */}
      <label htmlFor="label-filter" className="sr-only">
        Label
      </label>
      <select
        id="label-filter"
        aria-label="Label"
        value=""
        onChange={(e) => {
          const label = e.target.value;
          if (!label) return;
          const next = new Set(activeLabels);
          if (next.has(label)) {
            next.delete(label);
          } else {
            next.add(label);
          }
          onLabelsChange(next);
        }}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All Labels</option>
        {filterOptions.labels.map((label) => (
          <option key={label} value={label}>
            {activeLabels.has(label) ? `✓ ${label}` : label}
          </option>
        ))}
      </select>

      {/* Assignee filter */}
      <label htmlFor="assignee-filter" className="sr-only">
        Assignee
      </label>
      <select
        id="assignee-filter"
        aria-label="Assignee"
        value={activeAssignee ?? ''}
        onChange={(e) => onAssigneeChange(e.target.value || null)}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All Assignees</option>
        {filterOptions.assignees.map((assignee) => (
          <option key={assignee} value={assignee}>
            {assignee}
          </option>
        ))}
      </select>

      {/* Active filter chips */}

      {/* Epic chip */}
      {activeEpic && (
        <span
          data-testid={`epic-chip-${activeEpic}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground px-2 py-0.5 text-xs"
        >
          {filterOptions.epics.get(activeEpic) ?? activeEpic}
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

      {/* Label chips */}
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
              const next = new Set(activeLabels);
              next.delete(label);
              onLabelsChange(next);
            }}
            className="ml-0.5 hover:text-destructive transition-colors"
          >
            ×
          </button>
        </span>
      ))}

      {/* Assignee chip */}
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
  );
}

export default BacklogFilterBar;
