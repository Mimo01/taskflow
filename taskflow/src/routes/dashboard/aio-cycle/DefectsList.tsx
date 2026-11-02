import { Bug, FlaskConical, ListFilter, ShieldCheck, X } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterPopover, SortableHeader } from '@/components/ui/table-filter-sort';
import { severityLabel } from '@/lib/aio-cycle-charts';
import { compareDefectPriority } from '@/lib/aio-defect-sort';
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { statusPillClass } from '@/lib/statusStyles';
import { nextSort } from '@/lib/table-sort';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira/types';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { useIsPeeked } from '@/stores/peek.store';
import { severityOf, severityRaw } from './DefectSummary';
import { SectionHeading } from './RunSection';
import type { ResolvedDefect } from './useCycleDefects';

type DefectSortKey = 'key' | 'status' | 'priority' | 'severity' | 'assignee' | null;
type SortableKey = Exclude<DefectSortKey, null>;

const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';

// Shared by the header row and the data rows so columns line up. As the container widens
// the columns appear in this order: priority + assignee (icon / avatar only), then full
// priority, severity, full assignee and reporter, so a row is always exactly one line.
// Priority and severity sit before status.
const COL = {
  key: 'flex-none w-32 pl-4 pr-2',
  title: 'flex-1 min-w-0 px-2',
  status: 'flex-none w-28 px-2',
  priority: 'flex-none w-10 @[640px]:w-24 px-2 flex items-center',
  severity: 'flex-none w-20 px-2 hidden @[760px]:flex items-center',
  assignee: 'flex-none w-10 @[880px]:w-40 px-2 flex items-center',
  reporter: 'flex-none w-40 px-2 hidden @[1000px]:flex items-center',
} as const;

function isDoneDefect(d: ResolvedDefect): boolean {
  return !d.isLoading && d.issue?.fields.status?.statusCategory?.key === 'done';
}

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

/** Header label that shows a short form while the column is icon-only (narrow container). */
function CompactLabel({
  label,
  compact,
  until,
}: {
  label: string;
  compact: string;
  /** Container width (px) at which the full label replaces the compact one. */
  until: 640 | 880;
}) {
  return (
    <>
      <span className={until === 640 ? '@[640px]:hidden' : '@[880px]:hidden'} aria-hidden>
        {compact}
      </span>
      <span className={until === 640 ? 'hidden @[640px]:inline' : 'hidden @[880px]:inline'}>
        {label}
      </span>
    </>
  );
}

function PersonCell({
  person,
  nameFrom,
}: {
  person: JiraIssue['fields']['assignee'] | undefined;
  /** When set, the name is hidden (avatar only) below this container width. */
  nameFrom?: 880;
}) {
  if (!person) return <span>—</span>;
  return (
    <div className="flex min-w-0 items-center gap-1.5" title={person.displayName}>
      <CachedAvatar url={person.avatarUrls?.['48x48']} name={person.displayName} size={18} />
      <span className={cn('truncate', nameFrom === 880 && 'hidden @[880px]:inline')}>
        {person.displayName}
      </span>
    </div>
  );
}

function DefectRow({
  defect,
  onOpen,
  onKeyClick,
}: {
  defect: ResolvedDefect;
  onOpen: (resolvedKey: string) => void;
  onKeyClick: () => void;
}) {
  const { defectKey, issue, isLoading } = defect;
  const displayKey = issue?.key ?? defectKey;
  const resolvedKey = issue?.key ?? null;
  const isClickable = !isLoading && !!resolvedKey;
  const severity = severityOf(issue);
  const muted = 'text-xs text-muted-foreground';
  const cell = 'pointer-events-none relative';
  const isPeeked = useIsPeeked(displayKey);

  return (
    <div
      data-testid={`defect-row-${defectKey}`}
      data-peeked={isPeeked ? 'true' : undefined}
      className={cn(
        'group/row relative flex w-full items-center border-b border-border pr-2 transition-colors hover:bg-muted/30',
        isPeeked && PEEKED_ROW_CLASS,
      )}
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
      <div className={cn(COL.priority, CELL_PADDING, cell, muted)}>
        {isLoading ? (
          <Skeleton className="h-4 w-4 @[640px]:w-16" />
        ) : issue?.fields.priority ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <PriorityIcon priority={issue.fields.priority} />
            <span className="hidden truncate @[640px]:inline">{issue.fields.priority.name}</span>
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
      <div className={cn(COL.assignee, CELL_PADDING, cell, muted)}>
        {isLoading ? (
          <Skeleton className="h-4 w-4 @[880px]:w-20" />
        ) : (
          <PersonCell person={issue?.fields.assignee} nameFrom={880} />
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
 * Defects tab: summary strip, sortable/filterable one-line flex rows, All sort + filter state lives here.
 */
export function DefectsList({
  defects,
  isLoading,
  onOpenIssue,
  cycleName,
}: {
  defects: ResolvedDefect[];
  isLoading: boolean;
  onOpenIssue: (issueKey: string) => void;
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
  // Labels shown without the order number, but ordered by it ('1-Critical' before '2-Major').
  const severityOptions = useMemo(
    () => [...new Set(optionsOf(defects, severityRaw).map(severityLabel))],
    [defects],
  );
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
            return severityRaw(d.issue);
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

  // D-02: Done = Jira status category 'done'. Loading / unresolved rows stay in Open.
  const [openDefects, doneDefects] = useMemo(() => {
    const open: ResolvedDefect[] = [];
    const done: ResolvedDefect[] = [];
    for (const d of sorted) (isDoneDefect(d) ? done : open).push(d);
    return [open, done];
  }, [sorted]);

  const totalDone = useMemo(() => defects.filter(isDoneDefect).length, [defects]);
  const totalOpen = defects.length - totalDone;

  const handleSort = (key: SortableKey) => {
    const next = nextSort<SortableKey>({ key: sortKey, dir: sortDir }, key);
    setSortKey(next.key);
    setSortDir(next.dir);
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
  const headerProps = {
    activeSortKey: sortKey,
    activeSortDir: sortDir,
    onSort: handleSort,
    testIdPrefix: 'defects',
  };

  const renderSection = ({
    testId,
    title,
    rows,
    emptyIcon,
    emptyTitle,
    filteredOut,
  }: {
    testId: string;
    title: string;
    rows: ResolvedDefect[];
    emptyIcon: typeof Bug;
    emptyTitle: string;
    /** Section has items but the active filters hide them all. */
    filteredOut: boolean;
  }): ReactNode => (
    <section data-testid={testId} className="min-w-0">
      <SectionHeading title={title} count={rows.length} className="mb-0 px-4 pt-3 pb-2" />
      {rows.length > 0 ? (
        <div>
          <div className="sticky top-(--aio-sticky-top) z-20 flex w-full items-center border-b bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))] pr-2">
            <SortableHeader
              sortKey="key"
              label="Key"
              className={cn(COL.key, headerCell)}
              {...headerProps}
            />
            <div className={cn(COL.title, headerCell)}>Title</div>
            <SortableHeader
              sortKey="priority"
              label={<CompactLabel label="Priority" compact="Pri" until={640} />}
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
              sortKey="status"
              label="Status"
              className={cn(COL.status, headerCell)}
              {...headerProps}
            />
            <SortableHeader
              sortKey="assignee"
              label={<CompactLabel label="Assignee" compact="Asg." until={880} />}
              className={cn(COL.assignee, headerCell)}
              {...headerProps}
            />
            <div className={cn(COL.reporter, headerCell)}>Reporter</div>
          </div>
          {rows.map((d) => (
            <DefectRow
              key={d.defectKey}
              defect={d}
              onOpen={onOpenIssue}
              onKeyClick={() =>
                useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname })
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          icon={emptyIcon}
          title={emptyTitle}
          action={
            filteredOut ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      )}
    </section>
  );

  return (
    <div className="@container flex flex-col">
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

      <div className="flex flex-col gap-2">
        {renderSection({
          testId: 'defects-section-open',
          title: 'Open',
          rows: openDefects,
          filteredOut: totalOpen > 0,
          emptyIcon: totalOpen === 0 ? ShieldCheck : ListFilter,
          emptyTitle: totalOpen === 0 ? 'No open defects' : 'No open defects match the filters',
        })}
        {renderSection({
          testId: 'defects-section-done',
          title: 'Done',
          rows: doneDefects,
          filteredOut: totalDone > 0,
          emptyIcon: totalDone === 0 ? Bug : ListFilter,
          emptyTitle:
            totalDone === 0 ? 'No resolved defects yet' : 'No resolved defects match the filters',
        })}
      </div>
    </div>
  );
}
