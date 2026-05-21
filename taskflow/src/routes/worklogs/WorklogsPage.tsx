/**
 * WorklogsPage — Tempo Worklog Viewer
 *
 * TEMPO-01: Day-column pivot table (one row per person, one column per day)
 * TEMPO-02: Date presets (This Week default) + custom date range
 * TEMPO-03: Single-select people autocomplete filter (D-01, D-02, D-11)
 * TEMPO-04: Save named filter combining preset + person (D-04 inline input)
 * TEMPO-05: Load, rename, delete saved Tempo filters (D-03 row, D-05, D-06)
 * TEMPO-07: Totals column (per person) + totals row (per day) + grand total
 * D-08: Zero-hour cells render as blank empty string
 * T-62-06: jiraToken excluded from queryKey
 */

import { useQuery } from '@tanstack/react-query';
import { Check, Clock, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAssignableUsers } from '@/services/jira/users';
import { fetchWorklogs } from '@/services/tempo';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useTempoFiltersStore, type TempoFilter } from '@/stores/tempo-filters.store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'last-working-day' | 'custom';

// ─── Helpers (outside component for stable references) ────────────────────────

/** D-08: returns '' for zero; 'Xm', 'Xh', or 'Xh Ym' otherwise. */
function formatSeconds(secs: number): string {
  if (secs === 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format a YYYY-MM-DD string as a compact day header: "Wed 21"
 * Uses new Date(yyyymmdd + 'T00:00:00') to avoid timezone-shift bugs (RESEARCH A1).
 * toLocaleDateString is OK here — used for display label only, not as a data key.
 */
function formatDayHeader(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday} ${d.getDate()}`;
}

/**
 * Enumerate every YYYY-MM-DD from `from` to `to` inclusive.
 * Uses .toISOString().slice(0, 10) — NEVER toLocaleDateString() (Phase 61 pitfall).
 */
function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) {
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** This Week: ISO Monday → Sunday of the current week. */
function getThisWeekRange(): { from: string; to: string } {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

/** Last Week: the full Mon–Sun week before this week. */
function getLastWeekRange(): { from: string; to: string } {
  const { from } = getThisWeekRange();
  const monday = new Date(`${from}T00:00:00`);
  monday.setDate(monday.getDate() - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

/** This Month: 1st of current month → today. */
function getThisMonthRange(): { from: string; to: string } {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    from: first.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

/** Last Month: 1st → last day of previous calendar month. */
function getLastMonthRange(): { from: string; to: string } {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return {
    from: firstDay.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10),
  };
}

/**
 * Last Working Day: most recent Mon–Fri before today.
 * Mon → Fri (-3 days), Sun → Fri (-2 days), otherwise → yesterday (-1 day).
 */
function getLastWorkingDay(): string {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun, 1=Mon, ...
  const daysBack = dow === 1 ? 3 : dow === 0 ? 2 : 1;
  const d = new Date(today);
  d.setDate(today.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'this-week', label: 'This Week' },
  { id: 'last-week', label: 'Last Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'last-working-day', label: 'Last Working Day' },
  { id: 'custom', label: 'Custom' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorklogsPage() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  // IN-01: fine-grained selector avoids re-rendering on unrelated store mutations
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);

  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [preset, setPreset] = useState<DatePreset>('this-week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [selectedDisplayName, setSelectedDisplayName] = useState<string | null>(null);

  // Saved filters state (TEMPO-04, TEMPO-05)
  const [savingOpen, setSavingOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Combobox state
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tempo filters store (TEMPO-04, TEMPO-05)
  const { savedFilters, addFilter, removeFilter, renameFilter } = useTempoFiltersStore();

  // ─ Auth token effect (SprintProgressTab pattern) ─────────────────────────
  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  // ─ Compute from/to from preset ───────────────────────────────────────────
  const { from, to } = useMemo(() => {
    switch (preset) {
      case 'this-week':
        return getThisWeekRange();
      case 'last-week':
        return getLastWeekRange();
      case 'this-month':
        return getThisMonthRange();
      case 'last-month':
        return getLastMonthRange();
      case 'last-working-day': {
        const d = getLastWorkingDay();
        return { from: d, to: d };
      }
      case 'custom':
        return { from: customFrom, to: customTo };
    }
  }, [preset, customFrom, customTo]);

  // ─ TanStack Query ─────────────────────────────────────────────────────────
  // T-62-06: jiraToken MUST NOT appear in queryKey
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername ?? ''],
    queryFn: () =>
      fetchWorklogs(
        jiraBaseUrl!,
        jiraToken!,
        selectedUsername ? [selectedUsername] : [],
        from,
        to,
      ),
    enabled:
      !!jiraBaseUrl &&
      !!jiraToken &&
      tempoEnabled &&
      !!from &&
      !!to &&
      (preset !== 'custom' || (!!customFrom && !!customTo && customTo >= customFrom)),
  });

  // ─ People list (assignable users from Jira, same source as assignee picker) ─
  const { data: userResults } = useQuery({
    queryKey: ['jira', 'assignable-users', jiraBaseUrl, activeJiraProject, query],
    queryFn: () => fetchAssignableUsers(jiraBaseUrl!, jiraToken!, activeJiraProject!, query),
    enabled: open && !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
    staleTime: 30_000,
  });
  const people = userResults ?? [];

  // ─ Pivot table ────────────────────────────────────────────────────────────
  const { pivot, days, dayTotals, grandTotal } = useMemo(() => {
    const pivotMap = new Map<
      string,
      { displayName: string; dayMap: Map<string, number>; total: number }
    >();

    for (const w of data ?? []) {
      const name = w.author.name;
      if (!pivotMap.has(name)) {
        pivotMap.set(name, {
          displayName: w.author.displayName ?? name,
          dayMap: new Map(),
          total: 0,
        });
      }
      const entry = pivotMap.get(name)!;
      entry.dayMap.set(w.dateStarted, (entry.dayMap.get(w.dateStarted) ?? 0) + w.timeSpentSeconds);
      entry.total += w.timeSpentSeconds;
    }

    const daysArr = from && to ? enumerateDays(from, to) : [];

    const dayTotalsMap = new Map<string, number>();
    let grandTotalVal = 0;
    for (const [, entry] of pivotMap) {
      for (const day of daysArr) {
        const secs = entry.dayMap.get(day) ?? 0;
        dayTotalsMap.set(day, (dayTotalsMap.get(day) ?? 0) + secs);
        grandTotalVal += secs;
      }
    }

    return {
      pivot: pivotMap,
      days: daysArr,
      dayTotals: dayTotalsMap,
      grandTotal: grandTotalVal,
    };
  }, [data, from, to]);

  // ─ Combobox handlers ──────────────────────────────────────────────────────
  function handleComboboxFocus() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function handleComboboxBlur() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function handleComboboxChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handlePersonSelect(person: { name: string; displayName: string }) {
    setSelectedUsername(person.name);
    setSelectedDisplayName(person.displayName);
    setQuery('');
    setOpen(false);
  }

  function clearPersonFilter() {
    setSelectedUsername(null);
    setSelectedDisplayName(null);
    setQuery('');
  }

  // ─ Saved filters handlers (TEMPO-04, TEMPO-05) ────────────────────────────

  /** TEMPO-04: Confirm save — Pitfall 4: empty-name guard */
  function handleConfirmSave() {
    if (!saveName.trim()) return;
    addFilter({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: saveName.trim(),
      preset,
      username: selectedUsername,
      displayName: selectedDisplayName,
    });
    setSaveName('');
    setSavingOpen(false);
  }

  /** TEMPO-04: Cancel save */
  function handleCancelSave() {
    setSaveName('');
    setSavingOpen(false);
  }

  /** TEMPO-05/D-06: Load a saved filter into component state */
  function handleLoadFilter(filter: TempoFilter) {
    setPreset(filter.preset);
    setSelectedUsername(filter.username);
    setSelectedDisplayName(filter.displayName);
    setActiveFilterId(filter.id);
  }

  /** TEMPO-05/D-05: Delete a saved filter */
  function handleDeleteFilter(id: string) {
    removeFilter(id);
    if (activeFilterId === id) setActiveFilterId(null);
  }

  /** TEMPO-05/D-05: Commit rename on Enter or blur */
  function handleCommitRename(id: string, nextName: string) {
    if (nextName.trim()) {
      renameFilter(id, nextName.trim());
    }
    setRenamingId(null);
  }

  const filteredPeople = people;

  // ─ JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-xl font-semibold">Worklogs</h1>
      </header>

      {/* Saved filters row — D-03: separate row above filter bar, hidden when empty */}
      {savedFilters.length > 0 && (
        <div
          aria-label="Saved filters"
          className="flex items-center gap-2 px-6 py-2 border-b border-border bg-background flex-wrap"
        >
          {savedFilters.map((filter) => (
            // Pitfall 3: `group` class is required for group-hover on × button
            <div key={filter.id} className="group relative flex items-center">
              {renamingId === filter.id ? (
                <input
                  type="text"
                  defaultValue={filter.name}
                  aria-label="Rename filter"
                  autoFocus
                  className="h-5 text-xs border border-ring rounded px-1 focus:outline-none"
                  onBlur={(e) => handleCommitRename(filter.id, e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRename(filter.id, e.currentTarget.value);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => handleLoadFilter(filter)}
                  onDoubleClick={() => setRenamingId(filter.id)}
                  className={`inline-flex items-center gap-1 rounded-md text-xs leading-tight pl-2 pr-2.5 py-1 transition-colors cursor-pointer ${
                    filter.id === activeFilterId
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                  }`}
                >
                  {filter.name}
                </button>
              )}
              <button
                type="button"
                aria-label={`Delete ${filter.name} filter`}
                onClick={() => handleDeleteFilter(filter.id)}
                className="ml-1 w-6 h-6 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background flex-wrap">
        {/* Date preset pills */}
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPreset(p.id);
              setActiveFilterId(null);
            }}
            className={
              preset === p.id
                ? 'bg-accent text-accent-foreground font-semibold border border-border rounded-md px-3 h-7 text-xs'
                : 'hover:bg-accent text-foreground rounded-md px-3 h-7 text-xs'
            }
          >
            {p.label}
          </button>
        ))}

        {/* Custom date inputs */}
        {preset === 'custom' && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="min-w-32 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="min-w-32 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </>
        )}

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Active chip — shown when a person is selected */}
        {selectedDisplayName !== null && (
          <Badge variant="secondary" className="gap-1">
            {selectedDisplayName}
            <button
              type="button"
              aria-label={`Remove ${selectedDisplayName} filter`}
              onClick={clearPersonFilter}
              className="ml-0.5 hover:text-destructive transition-colors"
            >
              ×
            </button>
          </Badge>
        )}

        {/* People filter combobox */}
        <div className="relative">
          <label htmlFor="people-filter" className="sr-only">
            Filter by person
          </label>
          <input
            id="people-filter"
            role="combobox"
            aria-label="Filter by person"
            aria-autocomplete="list"
            aria-expanded={open}
            value={query}
            placeholder="Filter by person"
            onChange={handleComboboxChange}
            onFocus={handleComboboxFocus}
            onBlur={handleComboboxBlur}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
          />
          {open && filteredPeople.length > 0 && (
            <ul className="absolute z-20 mt-1 w-max min-w-full max-h-48 overflow-y-auto rounded border border-border bg-background shadow-md">
              {filteredPeople.map((person) => (
                <li key={person.name}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                    onMouseDown={() => handlePersonSelect(person)}
                  >
                    {person.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Save filter button / inline input (TEMPO-04, D-04) */}
        {savingOpen ? (
          <>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Filter name"
              aria-label="Filter name"
              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
            />
            <button
              type="button"
              aria-label="Confirm save"
              onClick={handleConfirmSave}
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={handleCancelSave}
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSavingOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 h-7 rounded-md hover:bg-accent transition-colors"
          >
            Save filter
          </button>
        )}
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isError && !data ? (
          <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
        ) : isLoading && !data ? (
          /* Loading skeleton grid: 5 rows × days columns */
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="text-left px-4 py-3 border border-border min-w-40 font-semibold text-muted-foreground">
                  Name
                </th>
                {Array.from({ length: days.length || 7 }, (_, i) => (
                  <th key={i} className="text-right px-4 py-3 border border-border min-w-14 font-semibold text-muted-foreground">
                    <Skeleton className="h-4 w-10 ml-auto" />
                  </th>
                ))}
                <th className="text-right px-4 py-3 border border-border min-w-18 font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="px-4 py-3 border border-border">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  {Array.from({ length: days.length || 7 }, (_, colIdx) => (
                    <td key={colIdx} className="text-right px-4 py-3 border border-border">
                      <Skeleton className="h-4 w-10 ml-auto" />
                    </td>
                  ))}
                  <td className="text-right px-4 py-3 border border-border">
                    <Skeleton className="h-4 w-10 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data?.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No worklogs found"
            subtitle={
              selectedDisplayName
                ? `No hours logged for ${selectedDisplayName} in the selected period.`
                : 'No hours were logged in the selected date range.'
            }
          />
        ) : (
          /* Data table: person × day pivot */
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="text-left px-4 py-3 border border-border min-w-40 font-semibold text-muted-foreground">
                  Name
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className="text-right px-4 py-3 border border-border min-w-14 font-semibold text-muted-foreground"
                  >
                    {formatDayHeader(day)}
                  </th>
                ))}
                <th className="text-right px-4 py-3 border border-border min-w-18 font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(pivot.entries()).map(([username, { displayName, dayMap, total }]) => (
                <tr key={username} className="hover:bg-accent/50">
                  <td className="px-4 py-3 border border-border">{displayName}</td>
                  {days.map((day) => (
                    <td key={day} className="text-right px-4 py-3 border border-border">
                      {formatSeconds(dayMap.get(day) ?? 0)}
                    </td>
                  ))}
                  <td className="text-right px-4 py-3 border border-border font-semibold">
                    {formatSeconds(total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted">
                <td className="px-4 py-3 border border-border font-semibold">Total</td>
                {days.map((day) => (
                  <td key={day} className="text-right px-4 py-3 border border-border font-semibold">
                    {formatSeconds(dayTotals.get(day) ?? 0)}
                  </td>
                ))}
                <td className="text-right px-4 py-3 border border-border font-semibold">
                  {formatSeconds(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
