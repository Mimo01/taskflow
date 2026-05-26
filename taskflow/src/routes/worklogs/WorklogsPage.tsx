/**
 * WorklogsPage — Tempo Worklog Viewer
 *
 * TEMPO-02: Date presets (This Week default) + custom date range
 * TEMPO-03: Single-select people autocomplete filter (D-01, D-02, D-11)
 * TEMPO-04: Save named filter combining preset + person (D-04 inline input)
 * TEMPO-05: Load, rename, delete saved Tempo filters (D-03 row, D-05, D-06)
 * TEMPO-07: Totals column (per issue) + totals row (per day) + grand total
 * TEMPO-08: Epic/story/subtask hierarchy table with sticky header + column
 * D-08: Zero-hour cells render as blank empty string
 * T-62-06: jiraToken excluded from queryKey
 */

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Bug,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  CornerDownRight,
  Layers,
  Pencil,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/apiFetch';
import { fetchAssignableUsers } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';
import { fetchUserSchedule, fetchWorklogs, type ScheduleDayType } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { type TempoFilter, useTempoFiltersStore } from '@/stores/tempo-filters.store';
import { WorklogCellPopover } from './WorklogCellPopover';
import type { DatePreset } from '@/services/tempo/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Enriched Jira issue shape returned by the worklog enrichment query */
type EnrichedIssue = {
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string; subtask: boolean };
    parent?: { key: string; fields: { summary: string } };
    [key: string]: unknown; // dynamic fields: epicLinkFieldKey, etc.
  };
};

// ─── Hierarchy node types (D-06) ─────────────────────────────────────────────

type DayMap = Map<string, number>; // YYYY-MM-DD -> seconds
type SubtaskNode = {
  summary: string;
  dayMap: DayMap;
  entries: import('@/services/tempo').TempoWorklog[];
};
type StoryNode = {
  summary: string;
  dayMap: DayMap;
  entries: import('@/services/tempo').TempoWorklog[];
  subtasks: Map<string, SubtaskNode>;
};
type EpicNode = {
  summary: string;
  dayMap: DayMap;
  entries: import('@/services/tempo').TempoWorklog[];
  stories: Map<string, StoryNode>;
};
type HierarchyMap = Map<string, EpicNode>; // key = epicKey or '__NO_EPIC__'

const NO_EPIC = '__NO_EPIC__';

// ─── Helpers (outside component for stable references) ────────────────────────

/** D-08: returns '' for zero; 'Xm', 'Xh', or 'Xh Ym' otherwise. */
export function formatSeconds(secs: number): string {
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
export function formatDayHeader(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday} ${d.getDate()}`;
}

/**
 * Enumerate every YYYY-MM-DD from `from` to `to` inclusive.
 * Uses local date components — NEVER toISOString() or toLocaleDateString() for data keys
 * (Phase 61 pitfall: toISOString() converts to UTC and shifts dates in non-UTC timezones).
 */
function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) {
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * Format a Date as a local YYYY-MM-DD string.
 * NEVER use .toISOString() for date arithmetic results: toISOString() converts to UTC
 * and shifts dates by a day in any timezone offset from UTC (RESEARCH A1).
 */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    from: localISO(monday),
    to: localISO(sunday),
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
    from: localISO(monday),
    to: localISO(sunday),
  };
}

/** This Month: 1st of current month → today. */
function getThisMonthRange(): { from: string; to: string } {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    from: localISO(first),
    to: localISO(today),
  };
}

/** Last Month: 1st → last day of previous calendar month. */
function getLastMonthRange(): { from: string; to: string } {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return {
    from: localISO(firstDay),
    to: localISO(lastDay),
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
  return localISO(d);
}

/** Returns bg class for a day DATA cell — always solid so brightness filter is visible. */
function dayColClass(type: ScheduleDayType | undefined, fallbackBg = 'bg-background'): string {
  if (type === 'HOLIDAY') return 'bg-red-100 dark:bg-red-900';
  if (type === 'NON_WORKING_DAY') return 'bg-slate-100 dark:bg-slate-800';
  return fallbackBg;
}

/**
 * Static CSS for row + column hover highlights.
 *
 * Row hover uses pure CSS `tr:hover`. Column hover uses a `data-col-hover` attribute on the
 * table (set imperatively via DOM ref on mouseover — no React re-render). Attribute selectors
 * are O(1) per cell, much cheaper than 45 separate `:has()` rules scanning the DOM.
 *
 * Neutral overlay: black (light) / white (dark) — matches the app's grayscale design system.
 * Pseudo-elements stack at row/column intersections (::after for row, ::before for column).
 */
const MAX_DAY_COLS = 45;
const COLUMN_HOVER_CSS = (() => {
  const base = `
    .worklog-table tbody td:not(.sticky){position:relative}
    .worklog-table tbody tr:hover :is(td,th)::after{content:'';position:absolute;inset:0;pointer-events:none;background:rgb(0 0 0 / 0.12)}
    .dark .worklog-table tbody tr:hover :is(td,th)::after{background:rgb(255 255 255 / 0.14)}
  `;
  const rules: string[] = [base];
  for (let n = 4; n <= 3 + MAX_DAY_COLS; n++) {
    rules.push(
      `.worklog-table[data-col-hover="${n}"] :is(td,th):nth-child(${n})::before{content:'';position:absolute;inset:0;pointer-events:none;background:rgb(0 0 0 / 0.12)}`,
      `.dark .worklog-table[data-col-hover="${n}"] :is(td,th):nth-child(${n})::before{background:rgb(255 255 255 / 0.14)}`,
    );
  }
  return rules.join('');
})();

/** Returns the full bg (+text) class for a sticky HEADER or FOOTER day cell, replacing bg-muted. */
function dayHeaderBg(type: ScheduleDayType | undefined): string {
  if (type === 'HOLIDAY') return 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300';
  if (type === 'NON_WORKING_DAY')
    return 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400';
  return 'bg-muted';
}

/** Returns the icon component + color class for a story-level issue type. */
function getIssueIcon(name: string | undefined): { IssueIcon: typeof BookOpen; color: string } {
  const n = (name ?? '').toLowerCase();
  if (n.includes('bug') || n.includes('defect')) return { IssueIcon: Bug, color: 'text-red-500' };
  return { IssueIcon: BookOpen, color: 'text-blue-600' };
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
  const { jiraBaseUrl, activeJiraProject, jiraUsername, jiraUserDisplayName, jiraUserKey } =
    useAuthStore();
  // IN-01: fine-grained selector avoids re-rendering on unrelated store mutations
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const epicLinkFieldKey = useSettingsStore((s) => s.epicLinkFieldKey);

  // D-08: outlet context for issue navigation (parallel to BacklogPage.tsx line 191)
  const { onIssueClick } = useOutletContext<{
    onIssueClick: (key: string, resetTrail?: boolean) => void;
  }>();

  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [preset, setPreset] = useState<DatePreset>('this-week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [selectedDisplayName, setSelectedDisplayName] = useState<string | null>(null);
  // userTouchedFilter: true once user has manually changed or cleared the person selection
  // prevents the default-me effect from overwriting an intentional user action
  const userTouchedFilter = useRef(false);

  // Saved filters state (TEMPO-04, TEMPO-05)
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Column-hover: imperative DOM mutation via ref — avoids React re-render on every hover.
  const tableRef = useRef<HTMLTableElement>(null);
  const handleTableMouseOver = (e: React.SyntheticEvent<HTMLTableElement>) => {
    const cell = (e.target as HTMLElement).closest('td, th') as HTMLTableCellElement | null;
    if (!cell || !tableRef.current) return;
    const n = cell.cellIndex + 1; // 1-based nth-child
    const current = tableRef.current.dataset.colHover;
    if (n < 4) {
      if (current) delete tableRef.current.dataset.colHover;
    } else if (current !== String(n)) {
      tableRef.current.dataset.colHover = String(n);
    }
  };
  const handleTableMouseLeave = () => {
    if (tableRef.current?.dataset.colHover) delete tableRef.current.dataset.colHover;
  };

  // Combobox state
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tempo filters store (TEMPO-04, TEMPO-05)
  const { savedFilters, addFilter, removeFilter, renameFilter, moveFilter } =
    useTempoFiltersStore();

  // ─ Auth token effect ─────────────────────────────────────────────────────
  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  // ─ Default "me" selection — seed once when store hydrates, never overwrite user choice ─
  useEffect(() => {
    if (jiraUsername && jiraUserDisplayName && !userTouchedFilter.current) {
      setSelectedUsername(jiraUsername);
      setSelectedDisplayName(jiraUserDisplayName);
    }
  }, [jiraUsername, jiraUserDisplayName]);

  // ─ CLEAN-01: Clear combobox close timer on unmount ───────────────────────
  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    };
  }, []);

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
      fetchWorklogs(jiraBaseUrl!, jiraToken!, selectedUsername ? [selectedUsername] : [], from, to),
    enabled:
      !!jiraBaseUrl &&
      !!jiraToken &&
      tempoEnabled &&
      !!from &&
      !!to &&
      (preset !== 'custom' || (!!customFrom && !!customTo && customTo >= customFrom)),
  });

  // ─ Unique issue keys (stable useMemo — Pitfall 2: must be stable for queryKey) ─
  const uniqueKeys = useMemo(
    () => [...new Set((data ?? []).map((w) => w.issue.key))].sort(),
    [data],
  );
  const uniqueKeysStr = uniqueKeys.join(','); // stable string for queryKey

  // ─ Dependent Jira enrichment query (TEMPO-08 / D-05) ────────────────────
  // T-62-06: jiraToken MUST NOT appear in queryKey
  const enrichQuery = useQuery({
    queryKey: ['jira', 'worklog-enrich', jiraBaseUrl, uniqueKeysStr, epicLinkFieldKey],
    queryFn: async () => {
      // Pitfall 7: guard empty list — issuekey in () is invalid JQL
      if (uniqueKeys.length === 0) return [] as EnrichedIssue[];
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      const base = jiraBaseUrl!.replace(/\/$/, '');
      const jql = encodeURIComponent(`issuekey in (${uniqueKeys.join(',')})`);
      // epicLinkFieldKey = discovered Epic Link field (classic: customfield_10014, varies by instance)
      const url = `${base}/rest/api/2/search?jql=${jql}&fields=summary,issuetype,parent,${epicLinkFieldKey}&maxResults=${uniqueKeys.length}`;
      const response = await apiFetch(
        'jira',
        url,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        'Enrich Worklog Issues',
      );
      if (!response.ok) throw new Error(`Enrichment failed: ${response.status}`);
      const d = await response.json();
      return d.issues as EnrichedIssue[];
    },
    enabled: !!jiraBaseUrl && !!jiraToken && !!data && uniqueKeys.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // ─ Parent keys for second enrichment (titles of parent epics/stories) ──────
  // Worklogs are logged against leaf issues; their parent epics/stories may not
  // be in uniqueKeys, so we discover them from the first enrichment response.
  const parentKeys = useMemo(() => {
    if (!enrichQuery.data) return [];
    const already = new Set(enrichQuery.data.map((i) => i.key));
    const parents = new Set<string>();
    for (const issue of enrichQuery.data) {
      // next-gen: parent.key; classic: epicLinkFieldKey (discovered per-instance, e.g. customfield_10014)
      const pk =
        issue.fields.parent?.key ?? (issue.fields[epicLinkFieldKey] as string | null) ?? null;
      if (pk && !already.has(pk)) parents.add(pk);
    }
    return [...parents].sort();
  }, [enrichQuery.data, epicLinkFieldKey]);
  const parentKeysStr = parentKeys.join(',');

  const parentEnrichQuery = useQuery({
    queryKey: ['jira', 'worklog-enrich-parents', jiraBaseUrl, parentKeysStr, epicLinkFieldKey],
    queryFn: async () => {
      if (parentKeys.length === 0) return [] as EnrichedIssue[];
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      const base = jiraBaseUrl!.replace(/\/$/, '');
      const jql = encodeURIComponent(`issuekey in (${parentKeys.join(',')})`);
      const url = `${base}/rest/api/2/search?jql=${jql}&fields=summary,issuetype,parent,${epicLinkFieldKey}&maxResults=${parentKeys.length}`;
      const response = await apiFetch(
        'jira',
        url,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        'Enrich Parent Issues',
      );
      if (!response.ok) throw new Error(`Parent enrichment failed: ${response.status}`);
      const d = await response.json();
      return d.issues as EnrichedIssue[];
    },
    enabled: !!jiraBaseUrl && !!jiraToken && parentKeys.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // ─ Grandparent keys: epics discovered from parentEnrichQuery results ────────
  // Case B: subtask → story (parentEnrichQuery) → epic (not yet fetched).
  // The story's epicLinkFieldKey points to an epic that wasn't in uniqueKeys or
  // parentKeys, so we need a third-level fetch.
  const grandparentKeys = useMemo(() => {
    if (!parentEnrichQuery.data) return [];
    const already = new Set([
      ...(enrichQuery.data ?? []).map((i) => i.key),
      ...(parentEnrichQuery.data ?? []).map((i) => i.key),
    ]);
    const grandparents = new Set<string>();
    for (const issue of parentEnrichQuery.data) {
      const pk =
        issue.fields.parent?.key ?? (issue.fields[epicLinkFieldKey] as string | null) ?? null;
      if (pk && !already.has(pk)) grandparents.add(pk);
    }
    return [...grandparents].sort();
  }, [parentEnrichQuery.data, enrichQuery.data, epicLinkFieldKey]);
  const grandparentKeysStr = grandparentKeys.join(',');

  const grandparentEnrichQuery = useQuery({
    queryKey: [
      'jira',
      'worklog-enrich-grandparents',
      jiraBaseUrl,
      grandparentKeysStr,
      epicLinkFieldKey,
    ],
    queryFn: async () => {
      if (grandparentKeys.length === 0) return [] as EnrichedIssue[];
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      const base = jiraBaseUrl!.replace(/\/$/, '');
      const jql = encodeURIComponent(`issuekey in (${grandparentKeys.join(',')})`);
      const url = `${base}/rest/api/2/search?jql=${jql}&fields=summary,issuetype,parent,${epicLinkFieldKey}&maxResults=${grandparentKeys.length}`;
      const response = await apiFetch(
        'jira',
        url,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        'Enrich Grandparent Issues',
      );
      if (!response.ok) throw new Error(`Grandparent enrichment failed: ${response.status}`);
      const d = await response.json();
      return d.issues as EnrichedIssue[];
    },
    enabled: !!jiraBaseUrl && !!jiraToken && grandparentKeys.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // ─ Schedule (for weekend/holiday column coloring) ────────────────────────
  const { data: scheduleData } = useQuery({
    queryKey: ['tempo', 'schedule', jiraBaseUrl, from, to, jiraUserKey ?? ''],
    queryFn: () => fetchUserSchedule(jiraBaseUrl!, jiraToken!, from, to, jiraUserKey!),
    enabled: !!jiraBaseUrl && !!jiraToken && !!jiraUserKey && tempoEnabled && !!from && !!to,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const dayTypeMap = scheduleData ?? new Map<string, ScheduleDayType>();

  // ─ People list (assignable users from Jira, same source as assignee picker) ─
  const { data: userResults } = useQuery({
    queryKey: ['jira', 'assignable-users', jiraBaseUrl, activeJiraProject, query],
    queryFn: () => fetchAssignableUsers(jiraBaseUrl!, jiraToken!, activeJiraProject!, query),
    enabled: open && !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
    staleTime: 30_000,
  });
  const people = userResults ?? [];

  // ─ Hierarchy table (TEMPO-08) ─────────────────────────────────────────────
  const { hierarchy, days, dayTotals, grandTotal, resolvedKeys, enrichMap } = useMemo(() => {
    const daysArr = from && to ? enumerateDays(from, to) : [];

    // Merge direct + parent enrichment; parent enrichment fixes titles of epic/story
    // rows whose issues have no direct worklogs (e.g. a story logged under subtasks only).
    const enrichMap = new Map<string, EnrichedIssue>([
      ...(enrichQuery.data ?? []).map((i): [string, EnrichedIssue] => [i.key, i]),
      ...(parentEnrichQuery.data ?? []).map((i): [string, EnrichedIssue] => [i.key, i]),
      ...(grandparentEnrichQuery.data ?? []).map((i): [string, EnrichedIssue] => [i.key, i]),
    ]);

    // summaryMap covers titles of issues not in enrichMap by reading nested parent.fields.summary
    // (Jira embeds one level of parent summary in the response for free — covers epics of stories).
    const summaryMap = new Map<string, string>();
    for (const issue of enrichMap.values()) {
      summaryMap.set(issue.key, issue.fields.summary);
      if (issue.fields.parent?.key) {
        const parentSummary = issue.fields.parent.fields?.summary;
        if (parentSummary) summaryMap.set(issue.fields.parent.key, parentSummary);
      }
    }

    // Top-level hierarchy map: epicKey | '__NO_EPIC__' → EpicNode
    const hierarchyMap: HierarchyMap = new Map();

    // Helper: ensure epic node exists
    function getOrCreateEpic(epicKey: string, summary: string): EpicNode {
      if (!hierarchyMap.has(epicKey)) {
        hierarchyMap.set(epicKey, {
          summary,
          dayMap: new Map(),
          entries: [],
          stories: new Map(),
        });
      }
      return hierarchyMap.get(epicKey)!;
    }

    // Helper: ensure story node under an epic
    function getOrCreateStory(epicNode: EpicNode, storyKey: string, summary: string): StoryNode {
      if (!epicNode.stories.has(storyKey)) {
        epicNode.stories.set(storyKey, {
          summary,
          dayMap: new Map(),
          entries: [],
          subtasks: new Map(),
        });
      }
      return epicNode.stories.get(storyKey)!;
    }

    const issueTotalsMap = new Map<string, number>();
    const dayTotalsMap = new Map<string, number>();
    let grandTotalVal = 0;

    for (const w of data ?? []) {
      const issueKey = w.issue.key;
      const secs = w.timeSpentSeconds;
      const date = w.dateStarted;
      const enriched = enrichMap.get(issueKey);

      // Issue classification (Pitfall 3: never use issuetype.name === 'Epic')
      const isSubtask = enriched?.fields.issuetype.subtask === true;
      // next-gen Jira: parent.key; classic Jira: epicLinkFieldKey (discovered per-instance)
      const parentKeyRaw =
        enriched?.fields.parent?.key ??
        (enriched?.fields[epicLinkFieldKey] as string | null) ??
        null;
      const hasParent = !!parentKeyRaw;

      // Accumulate into issueTotals and dayTotals (grand total)
      issueTotalsMap.set(issueKey, (issueTotalsMap.get(issueKey) ?? 0) + secs);
      dayTotalsMap.set(date, (dayTotalsMap.get(date) ?? 0) + secs);
      grandTotalVal += secs;

      if (isSubtask) {
        // Subtask: parent is story; story's parent is epic (next-gen or classic)
        const storyKey = enriched!.fields.parent!.key;
        const storyEnriched = enrichMap.get(storyKey);
        const epicKey =
          storyEnriched?.fields.parent?.key ??
          (storyEnriched?.fields[epicLinkFieldKey] as string | null) ??
          NO_EPIC;
        const epicSummary = epicKey === NO_EPIC ? NO_EPIC : (summaryMap.get(epicKey) ?? epicKey);
        const storySummary = summaryMap.get(storyKey) ?? storyKey;
        const subtaskSummary = summaryMap.get(issueKey) ?? issueKey;

        const epicNode = getOrCreateEpic(epicKey, epicSummary);
        const storyNode = getOrCreateStory(epicNode, storyKey, storySummary);

        if (!storyNode.subtasks.has(issueKey)) {
          storyNode.subtasks.set(issueKey, {
            summary: subtaskSummary,
            dayMap: new Map(),
            entries: [],
          });
        }
        const subtaskNode = storyNode.subtasks.get(issueKey)!;
        subtaskNode.dayMap.set(date, (subtaskNode.dayMap.get(date) ?? 0) + secs);
        subtaskNode.entries.push(w);

        // Propagate up to story and epic day maps
        storyNode.dayMap.set(date, (storyNode.dayMap.get(date) ?? 0) + secs);
        epicNode.dayMap.set(date, (epicNode.dayMap.get(date) ?? 0) + secs);
      } else if (hasParent) {
        // Story: parent is epic via parent.key (next-gen) or customfield_10014 (classic)
        const epicKey = parentKeyRaw!;
        const epicSummary = summaryMap.get(epicKey) ?? epicKey;
        const storySummary = summaryMap.get(issueKey) ?? issueKey;

        const epicNode = getOrCreateEpic(epicKey, epicSummary);
        const storyNode = getOrCreateStory(epicNode, issueKey, storySummary);
        storyNode.dayMap.set(date, (storyNode.dayMap.get(date) ?? 0) + secs);
        storyNode.entries.push(w);

        // Propagate to epic
        epicNode.dayMap.set(date, (epicNode.dayMap.get(date) ?? 0) + secs);
      } else {
        // Epic (or unresolvable): no parent, not a subtask
        const epicSummary = summaryMap.get(issueKey) ?? issueKey;
        const epicNode = getOrCreateEpic(issueKey, epicSummary);
        epicNode.dayMap.set(date, (epicNode.dayMap.get(date) ?? 0) + secs);
        epicNode.entries.push(w);
      }
    }

    // resolvedKeys: keys with a real title (not just the key string as fallback)
    const resolvedKeys = new Set(
      [...summaryMap.entries()].filter(([k, v]) => v !== k).map(([k]) => k),
    );

    return {
      hierarchy: hierarchyMap,
      days: daysArr,
      dayTotals: dayTotalsMap,
      grandTotal: grandTotalVal,
      issueTotals: issueTotalsMap,
      resolvedKeys,
      enrichMap,
    };
  }, [
    data,
    enrichQuery.data,
    parentEnrichQuery.data,
    grandparentEnrichQuery.data,
    from,
    to,
    epicLinkFieldKey,
  ]);

  // ─ Combobox handlers ──────────────────────────────────────────────────────
  function handleComboboxFocus() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Clear query so the dropdown opens with the full unfiltered list;
    // the input will display `query` (empty) while focused — selectedDisplayName
    // is restored on blur via the inputValue computation below.
    setQuery('');
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
    userTouchedFilter.current = true;
  }

  // ─ Saved filters handlers (TEMPO-04, TEMPO-05) ────────────────────────────

  /** TEMPO-04: Create filter immediately and enter rename mode inline on the pill */
  function handleSaveFilter() {
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    addFilter({
      id: newId,
      name: '',
      preset,
      username: selectedUsername,
      displayName: selectedDisplayName,
    });
    setActiveFilterId(newId);
    setRenamingId(newId);
    setRenameInput('');
    setTimeout(() => renameInputRef.current?.select(), 0);
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

  /** TEMPO-05: Open rename inline input via context menu */
  function handleStartRename(filter: TempoFilter) {
    setRenamingId(filter.id);
    setRenameInput(filter.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }

  /** TEMPO-05: Commit rename on Enter or blur; remove filter if name is empty (abandoned new save) */
  function handleCommitRename(id: string) {
    if (renameInput.trim()) {
      renameFilter(id, renameInput.trim());
    } else {
      removeFilter(id);
      if (activeFilterId === id) setActiveFilterId(null);
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
          {savedFilters.map((filter, idx) => {
            const isActive = filter.id === activeFilterId;
            const isFirst = idx === 0;
            const isLast = idx === savedFilters.length - 1;

            if (renamingId === filter.id) {
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1 rounded-md border border-ring bg-background pl-1.5 pr-1 py-0.5"
                >
                  <Bookmark className="size-3 shrink-0 text-muted-foreground" />
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitRename(filter.id);
                      if (e.key === 'Escape') {
                        handleCommitRename(filter.id);
                      }
                    }}
                    onBlur={() => handleCommitRename(filter.id)}
                    aria-label="Rename filter"
                    className="bg-transparent text-xs w-24 outline-none"
                  />
                </span>
              );
            }

            return (
              <ContextMenu key={filter.id}>
                <ContextMenuTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => handleLoadFilter(filter)}
                      className={`inline-flex items-center gap-1 rounded-md text-xs leading-tight pl-2 pr-2.5 py-1 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                      }`}
                    />
                  }
                >
                  <Bookmark className={`size-3 shrink-0 ${isActive ? 'fill-primary/40' : ''}`} />
                  <span className="truncate max-w-[120px]">{filter.name}</span>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => handleStartRename(filter)}>
                    <Pencil className="size-3.5" />
                    Rename
                  </ContextMenuItem>
                  {savedFilters.length > 1 && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        disabled={isFirst}
                        onClick={() => moveFilter(filter.id, 'left')}
                      >
                        <ArrowLeft className="size-3.5" />
                        Move left
                      </ContextMenuItem>
                      <ContextMenuItem
                        disabled={isLast}
                        onClick={() => moveFilter(filter.id, 'right')}
                      >
                        <ArrowRight className="size-3.5" />
                        Move right
                      </ContextMenuItem>
                      <ContextMenuItem
                        disabled={isFirst}
                        onClick={() => moveFilter(filter.id, 'front')}
                      >
                        <ChevronsLeft className="size-3.5" />
                        Move to front
                      </ContextMenuItem>
                      <ContextMenuItem
                        disabled={isLast}
                        onClick={() => moveFilter(filter.id, 'back')}
                      >
                        <ChevronsRight className="size-3.5" />
                        Move to back
                      </ContextMenuItem>
                    </>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => handleDeleteFilter(filter.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      )}

      {/* Filter bar */}
      <div className="relative z-10 flex items-center gap-2 px-6 py-3 border-b border-border bg-background flex-wrap">
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

        {/* People filter combobox — input IS the selection display (no chip) */}
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
            value={open ? query : (selectedDisplayName ?? query)}
            placeholder="Filter by person"
            onChange={handleComboboxChange}
            onFocus={handleComboboxFocus}
            onBlur={handleComboboxBlur}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-52"
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

        {/* Save filter button (TEMPO-04) — creates pill immediately, enters rename mode */}
        <button
          type="button"
          onClick={handleSaveFilter}
          className="inline-flex items-center gap-1 rounded-md text-xs leading-tight pl-2 pr-2.5 py-1 transition-colors cursor-pointer bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-dashed border-border"
        >
          <Bookmark className="size-3 shrink-0" />
          Save filter
        </button>
      </div>

      {/* Enrichment error alert — non-blocking, shows above table (D-07) */}
      {enrichQuery.isError && (
        <Alert variant="default" className="mx-6 mt-3">
          <AlertDescription>
            Some issues could not be loaded. Hours are still shown.
          </AlertDescription>
        </Alert>
      )}

      {/* Table area — border-separate fixes sticky-cell bleed-through (#5 in feedback) */}
      <div className="flex-1 overflow-auto min-h-0 isolate">
        {isError ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
          </div>
        ) : isLoading && !data ? (
          <table className="w-full text-xs border-separate [border-spacing:0]">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-background text-left px-3 py-2.5 border border-border border-r-0 min-w-52 max-w-52 font-bold text-foreground/50 uppercase tracking-widest text-[10px]">
                  Title
                </th>
                <th className="sticky top-0 left-52 z-30 bg-background text-left px-2 py-2.5 border border-border border-l-0 border-r-0 min-w-20 font-bold text-foreground/50 uppercase tracking-widest text-[10px]">
                  Key
                </th>
                <th className="sticky top-0 left-72 z-30 bg-background text-center px-2 py-2.5 border border-border border-l-0 border-r-2 min-w-14 font-bold text-foreground/50 uppercase tracking-widest text-[10px]">
                  Time
                </th>
                {Array.from({ length: days.length || 7 }, (_, i) => (
                  <th
                    key={i}
                    className="sticky top-0 z-20 bg-muted text-center px-2 py-2.5 border border-border min-w-14 font-bold uppercase tracking-widest text-[10px]"
                  >
                    <Skeleton className="h-3 w-8 mx-auto" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, r) => (
                <tr key={r}>
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 border border-border border-r-0 min-w-52 max-w-52">
                    <Skeleton className="h-3 w-28" />
                  </td>
                  <td className="sticky left-52 z-10 bg-background px-2 py-2 border border-border border-l-0 border-r-0 min-w-20">
                    <Skeleton className="h-3 w-14" />
                  </td>
                  <td className="sticky left-72 z-10 bg-background text-center px-2 py-2 border border-border border-l-0 border-r-2 min-w-14">
                    <Skeleton className="h-3 w-8 mx-auto" />
                  </td>
                  {Array.from({ length: days.length || 7 }, (_, c) => (
                    <td key={c} className="text-center px-2 py-2 border border-border">
                      <Skeleton className="h-3 w-8 mx-auto" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : data?.length === 0 ? (
          <div className="px-6 py-4">
            <EmptyState
              icon={Clock}
              title="No worklogs found"
              subtitle={
                selectedDisplayName
                  ? `No hours logged for ${selectedDisplayName} in the selected period.`
                  : 'No hours were logged in the selected date range.'
              }
            />
          </div>
        ) : (
          /* TEMPO-08: Epic → Story → Subtask hierarchy table */
          <table
            ref={tableRef}
            onMouseOver={handleTableMouseOver}
            onFocus={handleTableMouseOver}
            onMouseLeave={handleTableMouseLeave}
            onBlur={handleTableMouseLeave}
            className="worklog-table w-full text-xs border-separate [border-spacing:0]"
          >
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-background text-left px-3 py-2.5 border border-border border-r-0 min-w-52 max-w-52 font-bold text-foreground/50 uppercase tracking-widest text-[10px]">
                  Title
                </th>
                <th className="sticky top-0 left-52 z-30 bg-background text-left px-2 py-2.5 border border-border border-l-0 border-r-0 min-w-20 font-bold text-foreground/50 uppercase tracking-widest text-[10px]">
                  Key
                </th>
                <th className="sticky top-0 left-72 z-30 bg-background text-center px-2 py-2.5 border border-border border-l-0 border-r-2 min-w-14 font-bold text-foreground/50 uppercase tracking-widest text-[10px]">
                  Time
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className={`sticky top-0 z-20 text-center px-2 py-2.5 border border-border min-w-14 font-bold uppercase tracking-widest text-[10px] ${dayHeaderBg(dayTypeMap.get(day))}`}
                  >
                    {formatDayHeader(day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(hierarchy.entries()).map(([epicKey, epicNode]) => {
                const isNoEpic = epicKey === NO_EPIC;
                const isResolved = resolvedKeys.has(epicKey);
                const epicTotal = Array.from(epicNode.dayMap.values()).reduce((a, b) => a + b, 0);
                const epicRowBg = isNoEpic
                  ? 'bg-purple-50 dark:bg-purple-950'
                  : 'bg-purple-100 dark:bg-purple-900';

                return (
                  <React.Fragment key={epicKey}>
                    {/* Epic row */}
                    <tr
                      className={
                        isNoEpic
                          ? 'bg-purple-50 dark:bg-purple-950 group/row'
                          : 'bg-purple-100 dark:bg-purple-900 group/row'
                      }
                    >
                      <td
                        className={`sticky left-0 z-10 ${epicRowBg} px-3 py-1.5 border border-border border-r-0 min-w-52 max-w-52 overflow-hidden`}
                      >
                        {isNoEpic ? (
                          <span className="flex items-center gap-1 text-purple-400 dark:text-purple-600 italic text-[11px]">
                            <Layers className="size-3 shrink-0 text-purple-400 dark:text-purple-600" />
                            No Epic
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Open ${epicKey}`}
                            onClick={() => onIssueClick(epicKey)}
                            className="flex items-center gap-1 w-full text-left min-w-0 cursor-pointer"
                          >
                            <Layers className="size-3 shrink-0 text-purple-700 dark:text-purple-300" />
                            <span className="font-semibold leading-tight truncate text-purple-900 dark:text-purple-100">
                              {isResolved ? (
                                epicNode.summary
                              ) : (
                                <span className="line-through text-muted-foreground">
                                  {epicKey}
                                </span>
                              )}
                            </span>
                          </button>
                        )}
                      </td>
                      <td
                        className={`sticky left-52 z-10 ${epicRowBg} p-0 border border-border border-l-0 border-r-0 text-purple-500 dark:text-purple-400 whitespace-nowrap min-w-20`}
                      >
                        {isNoEpic ? '' : (
                          <button
                            type="button"
                            aria-label={`Open ${epicKey}`}
                            onClick={() => onIssueClick(epicKey)}
                            className="block w-full text-left px-2 py-1.5 cursor-pointer"
                          >
                            {epicKey}
                          </button>
                        )}
                      </td>
                      <td
                        className={`sticky left-72 z-10 ${epicRowBg} text-center px-2 py-1.5 border border-border border-l-0 border-r-2 font-semibold text-purple-800 dark:text-purple-200 min-w-14`}
                      >
                        {isNoEpic ? '' : formatSeconds(epicTotal) || '—'}
                      </td>
                      {days.map((day) => {
                        const secs = epicNode.dayMap.get(day) ?? 0;
                        const cellEntries = (data ?? []).filter(
                          (w) => w.issue.key === epicKey && w.dateStarted === day,
                        );
                        const cellBg = dayColClass(dayTypeMap.get(day), epicRowBg);
                        return (
                          <td key={day} className={`border border-border p-0 ${cellBg}`}>
                            <WorklogCellPopover
                              issueKey={epicKey}
                              date={day}
                              entries={cellEntries}
                              jiraBaseUrl={jiraBaseUrl!}
                              totalSeconds={secs}
                              dayColClassName={cellBg}
                            />
                          </td>
                        );
                      })}
                    </tr>

                    {/* Story rows */}
                    {Array.from(epicNode.stories.entries()).map(([storyKey, storyNode]) => {
                      const storyIssuetype = enrichMap.get(storyKey)?.fields.issuetype.name;
                      const { IssueIcon: StoryIcon, color: storyColor } =
                        getIssueIcon(storyIssuetype);
                      const storyTotal = Array.from(storyNode.dayMap.values()).reduce(
                        (a, b) => a + b,
                        0,
                      );
                      return (
                        <React.Fragment key={storyKey}>
                          <tr className="group/row">
                            <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border border-border border-r-0 min-w-52 max-w-52 overflow-hidden">
                              <button
                                type="button"
                                aria-label={`Open ${storyKey}`}
                                onClick={() => onIssueClick(storyKey)}
                                className="flex items-center gap-1 w-full text-left pl-3 min-w-0 cursor-pointer"
                              >
                                <StoryIcon className={`size-3 shrink-0 ${storyColor}`} />
                                <span className="font-medium leading-tight truncate">
                                  {resolvedKeys.has(storyKey) ? (
                                    storyNode.summary
                                  ) : (
                                    <span className="line-through text-muted-foreground">
                                      {storyKey}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </td>
                            <td className="sticky left-52 z-10 bg-background p-0 border border-border border-l-0 border-r-0 text-muted-foreground whitespace-nowrap min-w-20">
                              <button
                                type="button"
                                aria-label={`Open ${storyKey}`}
                                onClick={() => onIssueClick(storyKey)}
                                className="block w-full text-left px-2 py-1.5 cursor-pointer"
                              >
                                {storyKey}
                              </button>
                            </td>
                            <td className="sticky left-72 z-10 bg-background text-center px-2 py-1.5 border border-border border-l-0 border-r-2 font-semibold min-w-14">
                              {formatSeconds(storyTotal) || '—'}
                            </td>
                            {days.map((day) => {
                              const secs = storyNode.dayMap.get(day) ?? 0;
                              const cellEntries = (data ?? []).filter(
                                (w) => w.issue.key === storyKey && w.dateStarted === day,
                              );
                              const cellBg = dayColClass(dayTypeMap.get(day));
                              return (
                                <td key={day} className={`border border-border p-0 ${cellBg}`}>
                                  <WorklogCellPopover
                                    issueKey={storyKey}
                                    date={day}
                                    entries={cellEntries}
                                    jiraBaseUrl={jiraBaseUrl!}
                                    totalSeconds={secs}
                                    dayColClassName={cellBg}
                                  />
                                </td>
                              );
                            })}
                          </tr>

                          {/* Subtask rows */}
                          {Array.from(storyNode.subtasks.entries()).map(
                            ([subtaskKey, subtaskNode]) => {
                              const subtaskTotal = Array.from(subtaskNode.dayMap.values()).reduce(
                                (a, b) => a + b,
                                0,
                              );
                              return (
                                <tr
                                  key={`subtask-${subtaskKey}`}
                                  className="group/row"
                                >
                                  <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border border-border border-r-0 min-w-52 max-w-52 overflow-hidden">
                                    <button
                                      type="button"
                                      aria-label={`Open ${subtaskKey}`}
                                      onClick={() => onIssueClick(subtaskKey)}
                                      className="flex items-center gap-1 w-full text-left pl-6 min-w-0 cursor-pointer"
                                    >
                                      <CornerDownRight className="size-3 shrink-0 text-teal-500" />
                                      <span className="leading-tight text-muted-foreground truncate">
                                        {resolvedKeys.has(subtaskKey) ? (
                                          subtaskNode.summary
                                        ) : (
                                          <span className="line-through">{subtaskKey}</span>
                                        )}
                                      </span>
                                    </button>
                                  </td>
                                  <td className="sticky left-52 z-10 bg-background p-0 border border-border border-l-0 border-r-0 text-muted-foreground/60 whitespace-nowrap min-w-20">
                                    <button
                                      type="button"
                                      aria-label={`Open ${subtaskKey}`}
                                      onClick={() => onIssueClick(subtaskKey)}
                                      className="block w-full text-left px-2 py-1.5 cursor-pointer"
                                    >
                                      {subtaskKey}
                                    </button>
                                  </td>
                                  <td className="sticky left-72 z-10 bg-background text-center px-2 py-1.5 border border-border border-l-0 border-r-2 font-semibold text-muted-foreground min-w-14">
                                    {formatSeconds(subtaskTotal) || '—'}
                                  </td>
                                  {days.map((day) => {
                                    const secs = subtaskNode.dayMap.get(day) ?? 0;
                                    const cellEntries = (data ?? []).filter(
                                      (w) => w.issue.key === subtaskKey && w.dateStarted === day,
                                    );
                                    const cellBg = dayColClass(dayTypeMap.get(day));
                                    return (
                                      <td
                                        key={day}
                                        className={`border border-border p-0 ${cellBg}`}
                                      >
                                        <WorklogCellPopover
                                          issueKey={subtaskKey}
                                          date={day}
                                          entries={cellEntries}
                                          jiraBaseUrl={jiraBaseUrl!}
                                          totalSeconds={secs}
                                          dayColClassName={cellBg}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            },
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 bottom-0 z-20 bg-muted px-3 py-1.5 border border-border border-r-0 font-bold uppercase tracking-widest text-[10px] text-foreground/60">
                  Total
                </td>
                <td className="sticky left-52 bottom-0 z-20 bg-muted border border-border border-l-0 border-r-0 min-w-20"></td>
                <td className="sticky left-72 bottom-0 z-20 bg-muted text-center px-2 py-1.5 border border-border border-l-0 border-r-2 font-semibold min-w-14">
                  {formatSeconds(grandTotal)}
                </td>
                {days.map((day) => (
                  <td
                    key={day}
                    className={`sticky bottom-0 z-10 text-center px-2 py-1.5 border border-border font-semibold ${dayHeaderBg(dayTypeMap.get(day))}`}
                  >
                    {formatSeconds(dayTotals.get(day) ?? 0)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      {/* Pure-CSS column hover (issue #3) — :has() + :nth-child() avoids React re-renders.
          Static rules generated once at module load; only active day columns trigger them. */}
      <style>{COLUMN_HOVER_CSS}</style>
    </div>
  );
}
