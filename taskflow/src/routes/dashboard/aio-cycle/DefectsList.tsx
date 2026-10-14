import { ChevronDown, ChevronUp, FlaskConical, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { compareDefectPriority } from '@/lib/aio-defect-sort';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { AioTestRun } from '@/services/aio';
import type { JiraIssue } from '@/services/jira/types';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { DefectSummary, severityOf } from './DefectSummary';
import type { ResolvedDefect } from './useCycleDefects';

type DefectSortKey = 'key' | 'status' | 'priority' | 'severity' | 'assignee' | null;
type SortableKey = Exclude<DefectSortKey, null>;

const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';

// Shared by the header row and the data rows so columns line up. Reporter, assignee,
// severity, priority and triggered-by drop (in that order) as the container narrows,
// so a row is always exactly one line.
const COL = {
  key: 'flex-none w-32 pl-4 pr-2',
  title: 'flex-1 min-w-0 px-2',
  status: 'flex-none w-32 px-2',
  triggered: 'flex-none w-44 px-2 hidden @[640px]:flex items-center gap-1',
  priority: 'flex-none w-28 px-2 hidden @[760px]:flex items-center',
  severity: 'flex-none w-24 px-2 hidden @[880px]:flex items-center',
  assignee: 'flex-none w-40 px-2 hidden @[1000px]:flex items-center',
  reporter: 'flex-none w-40 px-2 hidden @[1160px]:flex items-center',
} as const;

const MAX_TRIGGER_CHIPS = 2;

function optionsOf(
  defects: ResolvedDefect[],
  pick: (issue: JiraIssue) => string | null | undefined,
): string[] {
  const vals = defects
    .filter((d) => !d.isLoading && d.issue)
    .map((d) => (d.issue ? pick(d.issue) : null))
    .filter(Boolean) as string[];
  return [...new Set(vals)].sort();
}

function SortableHeader({
  sortKey,
  label,
  className,
  activeSortKey,
  activeSortDir,
  onSort,
}: {
  sortKey: SortableKey;
  label: string;
  className: string;
  activeSortKey: DefectSortKey;
  activeSortDir: 'asc' | 'desc';
  onSort: (key: SortableKey) => void;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <div className={className}>
      <button
        type="button"
        data-testid={`defects-sort-header-${sortKey}`}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive && activeSortDir === 'asc' && (
          <ChevronUp className="w-3 h-3" data-testid={`defects-sort-indicator-${sortKey}`} />
        )}
        {isActive && activeSortDir === 'desc' && (
          <ChevronDown className="w-3 h-3" data-testid={`defects-sort-indicator-${sortKey}`} />
        )}
      </button>
    </div>
  );
}

function FilterPopover({
  dimension,
  testId,
  options,
  selected,
  setSelected,
}: {
  dimension: string;
  testId: string;
  options: string[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const isActive = selected.size > 0;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            data-testid={testId}
          />
        }
      >
        {dimension}
        {isActive && <span className="ml-0.5 opacity-70">({selected.size})</span>}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">No options available</p>
        ) : (
          <ul className="max-h-48 overflow-auto space-y-0.5">
            {options.map((opt) => {
              const checked = selected.has(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-muted flex items-center gap-2 ${checked ? 'font-medium' : ''}`}
                    onClick={() => {
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (n.has(opt)) n.delete(opt);
                        else n.add(opt);
                        return n;
                      });
                    }}
                  >
                    <span
                      className={`w-3 h-3 border rounded-sm flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                    >
                      {checked && (
                        <span className="text-primary-foreground text-[8px] leading-none">✓</span>
                      )}
                    </span>
                    {opt}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PersonCell({ person }: { person: JiraIssue['fields']['assignee'] | undefined }) {
  if (!person) return <span>—</span>;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <CachedAvatar url={person.avatarUrls?.['48x48']} name={person.displayName} size={18} />
      <span className="truncate">{person.displayName}</span>
    </div>
  );
}

function TriggerChips({
  defectId,
  runs,
  onOpenRun,
}: {
  defectId: string;
  runs: AioTestRun[];
  onOpenRun: (run: AioTestRun) => void;
}) {
  const shown = runs.slice(0, MAX_TRIGGER_CHIPS);
  const extra = runs.length - shown.length;
  if (runs.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      {shown.map((run) =>
        run.id ? (
          <button
            key={run.id}
            type="button"
            data-testid={`defect-trigger-${defectId}-${run.id}`}
            title={run.testCase?.title ?? run.testCaseKey}
            onClick={() => onOpenRun(run)}
            className="pointer-events-auto relative z-10 flex-none rounded border border-border px-1.5 font-mono text-[11px] leading-5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {run.testCaseKey}
          </button>
        ) : (
          <span
            key={run.testCaseKey}
            className="flex-none font-mono text-[11px] leading-5 text-muted-foreground"
          >
            {run.testCaseKey}
          </span>
        ),
      )}
      {extra > 0 && (
        <span
          className="flex-none text-[11px] text-muted-foreground"
          title={runs
            .slice(MAX_TRIGGER_CHIPS)
            .map((r) => r.testCaseKey)
            .join(', ')}
        >
          +{extra}
        </span>
      )}
    </>
  );
}

function DefectRow({
  defect,
  onOpen,
  onOpenRun,
  onKeyClick,
}: {
  defect: ResolvedDefect;
  onOpen: (resolvedKey: string) => void;
  onOpenRun: (run: AioTestRun) => void;
  onKeyClick: () => void;
}) {
  const { defectKey, issue, isLoading, triggeredByRuns } = defect;
  const displayKey = issue?.key ?? defectKey;
  const resolvedKey = issue?.key ?? null;
  const isClickable = !isLoading && !!resolvedKey;
  const severity = severityOf(issue);
  const muted = 'text-xs text-muted-foreground';
  const cell = 'pointer-events-none relative';

  return (
    <div
      data-testid={`defect-row-${defectKey}`}
      className="group/row relative flex w-full items-center border-b border-border pr-2 transition-colors hover:bg-muted/30"
    >
      {isClickable && (
        <button
          type="button"
          aria-label={`Open ${resolvedKey}`}
          className="absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            if (resolvedKey) onOpen(resolvedKey);
          }}
        />
      )}
      <div className={cn(COL.key, CELL_PADDING, cell, 'font-mono text-sm')}>
        <div className="flex items-center gap-1.5">
          {issue?.fields.issuetype?.name !== undefined && (
            <IssueTypeIcon typeName={issue.fields.issuetype.name} />
          )}
          <NavLink
            to={`/issue/${displayKey}`}
            className="pointer-events-auto relative z-10 truncate hover:underline"
            onClick={onKeyClick}
          >
            {displayKey}
          </NavLink>
        </div>
      </div>
      <div className={cn(COL.title, CELL_PADDING, cell, 'truncate text-sm')}>
        {isLoading ? (
          <Skeleton className="h-4 w-32" data-testid={`defect-title-loading-${defectKey}`} />
        ) : (
          <span title={issue?.fields.summary ?? displayKey}>
            {issue?.fields.summary ?? displayKey}
          </span>
        )}
      </div>
      <div className={cn(COL.status, CELL_PADDING, cell)}>
        {issue?.fields.status ? (
          <div className="flex">
            <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
              {issue.fields.status.name}
            </span>
          </div>
        ) : (
          <span className={muted}>—</span>
        )}
      </div>
      <div className={cn(COL.triggered, CELL_PADDING, cell, 'overflow-hidden')}>
        <TriggerChips defectId={defectKey} runs={triggeredByRuns} onOpenRun={onOpenRun} />
      </div>
      <div className={cn(COL.priority, CELL_PADDING, cell, muted)}>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : issue?.fields.priority ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <PriorityIcon priority={issue.fields.priority} />
            <span className="truncate">{issue.fields.priority.name}</span>
          </div>
        ) : (
          <span>—</span>
        )}
      </div>
      <div className={cn(COL.severity, CELL_PADDING, cell, muted)}>
        {isLoading ? (
          <Skeleton className="h-4 w-14" />
        ) : severity ? (
          <span className="truncate">{severity}</span>
        ) : (
          <span>—</span>
        )}
      </div>
      <div className={cn(COL.assignee, CELL_PADDING, cell, muted)}>
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <PersonCell person={issue?.fields.assignee} />
        )}
      </div>
      <div className={cn(COL.reporter, CELL_PADDING, cell, muted)}>
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <PersonCell person={issue?.fields.reporter} />
        )}
      </div>
    </div>
  );
}

/**
 * Defects tab: summary strip, sortable/filterable one-line flex rows, and triggered-by
 * chips that open the run. All sort + filter state lives here.
 */
export function DefectsList({
  defects,
  isLoading,
  onOpenIssue,
  onOpenRun,
  cycleName,
}: {
  defects: ResolvedDefect[];
  isLoading: boolean;
  onOpenIssue: (issueKey: string) => void;
  onOpenRun: (run: AioTestRun) => void;
  cycleName: string;
}) {
  const location = useLocation();
  const [sortKey, setSortKey] = useState<DefectSortKey>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());

  // Filter options derive from resolved (non-loading) issues.
  const statusOptions = useMemo(() => optionsOf(defects, (i) => i.fields.status?.name), [defects]);
  const priorityOptions = useMemo(
    () => optionsOf(defects, (i) => i.fields.priority?.name),
    [defects],
  );
  const severityOptions = useMemo(() => optionsOf(defects, severityOf), [defects]);
  const assigneeOptions = useMemo(
    () => optionsOf(defects, (i) => i.fields.assignee?.displayName),
    [defects],
  );

  const anyFilterActive =
    statusFilter.size > 0 ||
    priorityFilter.size > 0 ||
    severityFilter.size > 0 ||
    assigneeFilter.size > 0;

  const filtered = useMemo(() => {
    if (!anyFilterActive) return defects;
    return defects.filter((d) => {
      if (d.isLoading || !d.issue) return false; // loading rows excluded while filtering
      const f = d.issue.fields;
      const sev = severityOf(d.issue);
      return (
        (statusFilter.size === 0 || (!!f.status?.name && statusFilter.has(f.status.name))) &&
        (priorityFilter.size === 0 ||
          (!!f.priority?.name && priorityFilter.has(f.priority.name))) &&
        (severityFilter.size === 0 || (!!sev && severityFilter.has(sev))) &&
        (assigneeFilter.size === 0 ||
          (!!f.assignee?.displayName && assigneeFilter.has(f.assignee.displayName)))
      );
    });
  }, [defects, anyFilterActive, statusFilter, priorityFilter, severityFilter, assigneeFilter]);

  // Stable sort; missing/loading values always go to the bottom.
  const sorted = useMemo(() => {
    if (sortKey === null) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const getVal = (d: ResolvedDefect): string | null => {
        if (d.isLoading || !d.issue) return null;
        switch (sortKey) {
          case 'key':
            return d.issue.key ?? d.defectKey;
          case 'status':
            return d.issue.fields.status?.name ?? null;
          case 'severity':
            return severityOf(d.issue);
          case 'assignee':
            return d.issue.fields.assignee?.displayName ?? null;
          default:
            return null;
        }
      };
      if (sortKey === 'priority') {
        const ap = a.isLoading ? null : (a.issue?.fields.priority ?? null);
        const bp = b.isLoading ? null : (b.issue?.fields.priority ?? null);
        if (ap === null && bp === null) return 0;
        if (ap === null) return 1;
        if (bp === null) return -1;
        return compareDefectPriority(ap, bp) * dir;
      }
      const av = getVal(a);
      const bv = getVal(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av.localeCompare(bv) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortableKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  };

  const activeChips = useMemo(() => {
    const drop = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) => () =>
      setter((prev) => {
        const n = new Set(prev);
        n.delete(v);
        return n;
      });
    const chips: { dimension: string; value: string; remove: () => void }[] = [];
    for (const v of statusFilter)
      chips.push({ dimension: 'Status', value: v, remove: drop(setStatusFilter, v) });
    for (const v of priorityFilter)
      chips.push({
        dimension: 'Priority',
        value: v,
        remove: drop(setPriorityFilter, v),
      });
    for (const v of severityFilter)
      chips.push({
        dimension: 'Severity',
        value: v,
        remove: drop(setSeverityFilter, v),
      });
    for (const v of assigneeFilter)
      chips.push({
        dimension: 'Assignee',
        value: v,
        remove: drop(setAssigneeFilter, v),
      });
    return chips;
  }, [statusFilter, priorityFilter, severityFilter, assigneeFilter]);

  const clearAllFilters = () => {
    setStatusFilter(new Set());
    setPriorityFilter(new Set());
    setSeverityFilter(new Set());
    setAssigneeFilter(new Set());
  };

  if (defects.length === 0) {
    if (isLoading) {
      return (
        <div data-testid="defects-skeleton" className="flex flex-col">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-2.5">
              <Skeleton className="h-3.5 w-20 flex-none" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-5 w-24 flex-none" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <EmptyState
        icon={FlaskConical}
        title="No defects"
        subtitle="No defects are linked to runs in this cycle."
      />
    );
  }

  const headerCell = cn(CELL_PADDING, 'text-xs font-medium text-muted-foreground');
  const headerProps = { activeSortKey: sortKey, activeSortDir: sortDir, onSort: handleSort };

  return (
    <div className="@container flex flex-col">
      <DefectSummary defects={defects} />

      <div
        role="toolbar"
        aria-label="Defects filters"
        className="flex flex-wrap items-center gap-2 border-b px-4 py-2 density-compact:py-1 density-comfortable:py-3"
      >
        <FilterPopover
          dimension="Status"
          testId="defects-filter-status"
          options={statusOptions}
          selected={statusFilter}
          setSelected={setStatusFilter}
        />
        <FilterPopover
          dimension="Priority"
          testId="defects-filter-priority"
          options={priorityOptions}
          selected={priorityFilter}
          setSelected={setPriorityFilter}
        />
        <FilterPopover
          dimension="Severity"
          testId="defects-filter-severity"
          options={severityOptions}
          selected={severityFilter}
          setSelected={setSeverityFilter}
        />
        <FilterPopover
          dimension="Assignee"
          testId="defects-filter-assignee"
          options={assigneeOptions}
          selected={assigneeFilter}
          setSelected={setAssigneeFilter}
        />

        {activeChips.map((chip) => (
          <span
            key={`${chip.dimension}-${chip.value}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {chip.dimension}: {chip.value}
            <button
              type="button"
              className="hover:text-primary/60 shrink-0"
              data-testid={`defects-filter-chip-${chip.dimension.toLowerCase()}-${chip.value}`}
              onClick={chip.remove}
              aria-label={`Remove filter ${chip.dimension}: ${chip.value}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {anyFilterActive && (
          <button
            type="button"
            data-testid="defects-filter-clear-all"
            className="ml-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        )}
      </div>

      {sorted.length === 0 && anyFilterActive ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          No defects match the selected filters.
        </p>
      ) : (
        <div>
          <div className="sticky top-(--aio-sticky-top) z-10 flex w-full items-center border-b bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))] pr-2">
            <SortableHeader
              sortKey="key"
              label="Key"
              className={cn(COL.key, headerCell)}
              {...headerProps}
            />
            <div className={cn(COL.title, headerCell)}>Title</div>
            <SortableHeader
              sortKey="status"
              label="Status"
              className={cn(COL.status, headerCell)}
              {...headerProps}
            />
            <div className={cn(COL.triggered, headerCell)}>Triggered By</div>
            <SortableHeader
              sortKey="priority"
              label="Priority"
              className={cn(COL.priority, headerCell)}
              {...headerProps}
            />
            <SortableHeader
              sortKey="severity"
              label="Severity"
              className={cn(COL.severity, headerCell)}
              {...headerProps}
            />
            <SortableHeader
              sortKey="assignee"
              label="Assignee"
              className={cn(COL.assignee, headerCell)}
              {...headerProps}
            />
            <div className={cn(COL.reporter, headerCell)}>Reporter</div>
          </div>
          {sorted.map((d) => (
            <DefectRow
              key={d.defectKey}
              defect={d}
              onOpen={onOpenIssue}
              onOpenRun={onOpenRun}
              onKeyClick={() =>
                useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
