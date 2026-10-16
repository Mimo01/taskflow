/**
 * CommandPalette -- full command palette overlay: ranked, tiered issue search from the local
 * GreenHopper index (instant title hits), one debounced Jira body request, opt-in closed
 * issues, pinned Direct match, query-filtered MR/Navigation/Action groups, and the
 * Recent Items default state.
 *
 * Built with shadcn Command (cmdk) primitives in a custom overlay (the Radix dialog wrapper
 * conflicts with @base-ui/react). cmdk filtering is disabled (shouldFilter={false}); ordering and
 * filtering come from lib/global-search.ts.
 */

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Clock, GitMerge, SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { SearchResultRow } from '@/components/app/SearchResultRow';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSearchSources } from '@/hooks/useGlobalSearchSources';
import {
  buildResultModel,
  buildSearchIndex,
  entryFromJiraIssue,
  findIndexEntry,
  isKeyLikeQuery,
  matchesSecondary,
  type ResultRow,
  resolveKeyLookup,
} from '@/lib/global-search';
import { NAV_SHORTCUTS } from '@/lib/shortcuts';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { fetchJiraIssueByKey, searchJiraBody } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { applyTheme, saveTheme, type Theme } from '@/services/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { useSettingsStore } from '@/stores/settings.store';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Navigate to full-page issue detail (used by Plan 04 key-element click split). */
  onIssueClick?: (issueKey: string) => void;
  /** Open peek panel for body selection (used by this plan and Plan 04 body click). */
  onOpenIssue: (issueKey: string) => void;
  onNavigate: (path: string) => void;
  onOpenNotifications: () => void;
  onOpenCreate: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  onIssueClick,
  onNavigate,
  onOpenNotifications,
  onOpenCreate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [selectedValue, setSelectedValue] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const { storyPointsFieldKey, theme, setTheme, epicLinkFieldKey } = useSettingsStore();
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();

  // D-03/D-21: index sources load from any route while open (hook must run before the early return)
  const { backlog, allData, isIndexLoading, isIndexError } = useGlobalSearchSources(open);
  const index = useMemo(() => buildSearchIndex(backlog, allData), [backlog, allData]);

  const trimmed = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce: fire body search 300ms after user stops typing (>=2 chars)
  useEffect(() => {
    if (trimmed.length < 2) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(timer);
  }, [trimmed]);

  // New query: collapse tiers, drop closed opt-in, reset selection and scroll (never on data change)
  // biome-ignore lint/correctness/useExhaustiveDependencies: trimmed is the intentional trigger
  useEffect(() => {
    setIncludeClosed(false);
    setExpandedTiers(new Set());
    setSelectedValue('');
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [trimmed]);

  const resolvedKeyLookup = resolveKeyLookup(trimmed, activeJiraProject);
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem);
  const recentItems = useRecentItemsStore((s) => s.items);

  // KEYS migration: all keyboard shortcuts use react-hotkeys-hook (no raw window listeners)
  // enableOnFormTags: true is intentional -- Escape must close the palette even while typing
  useHotkeys('escape', onClose, { enableOnFormTags: true, enabled: open });

  // Reset state when palette closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setIncludeClosed(false);
      setExpandedTiers(new Set());
      setSelectedValue('');
    }
  }, [open]);

  // ─── Cached data access (NO API calls for cached results) ──────────────────

  const cachedSprintBoard = queryClient.getQueryData<{ issues: JiraIssue[] }>([
    'jira-issues',
    'sprint-board',
    activeJiraProject,
    storyPointsFieldKey,
  ]);
  const cachedIssuesMap = new Map<string, JiraIssue>();
  for (const issue of cachedSprintBoard?.issues ?? []) cachedIssuesMap.set(issue.key, issue);

  // Flatten MRs: merge assigned + reviewRequested from all gitlab-mrs cache entries, deduplicate by iid
  const gitlabCacheEntries = queryClient.getQueriesData<{
    assigned: GitLabMR[];
    reviewRequested: GitLabMR[];
  }>({ queryKey: ['gitlab-mrs'] });

  const mrsMap = new Map<number, GitLabMR>();
  for (const [, data] of gitlabCacheEntries) {
    if (!data) continue;
    for (const mr of data.assigned ?? []) {
      if (!mrsMap.has(mr.iid)) mrsMap.set(mr.iid, mr);
    }
    for (const mr of data.reviewRequested ?? []) {
      if (!mrsMap.has(mr.iid)) mrsMap.set(mr.iid, mr);
    }
  }
  const allMRs = Array.from(mrsMap.values());

  // ─── Jira body / closed search (one debounced request each, D-02 / D-15) ───

  const searchEnabled =
    open &&
    debouncedQuery.length >= 2 &&
    !isKeyLikeQuery(debouncedQuery) &&
    !!jiraBaseUrl &&
    !!activeJiraProject;

  const bodyQuery = useQuery({
    queryKey: ['search', 'body', debouncedQuery, activeJiraProject, 'open', epicLinkFieldKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat');
      if (!token || !jiraBaseUrl || !activeJiraProject) return [] as JiraIssue[];
      return searchJiraBody(jiraBaseUrl, token, {
        projectKey: activeJiraProject,
        query: debouncedQuery,
        scope: 'open',
        epicLinkFieldKey,
      });
    },
    enabled: searchEnabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const closedQuery = useQuery({
    queryKey: ['search', 'body', debouncedQuery, activeJiraProject, 'closed', epicLinkFieldKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat');
      if (!token || !jiraBaseUrl || !activeJiraProject) return [] as JiraIssue[];
      return searchJiraBody(jiraBaseUrl, token, {
        projectKey: activeJiraProject,
        query: debouncedQuery,
        scope: 'closed',
        epicLinkFieldKey,
      });
    },
    enabled: searchEnabled && includeClosed,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });

  // Hide stale previous-query rows (placeholder data and the 300 ms debounce gap)
  const bodyFresh = debouncedQuery === trimmed && !bodyQuery.isPlaceholderData;
  const closedFresh = debouncedQuery === trimmed && !closedQuery.isPlaceholderData;
  const bodyData = bodyQuery.data;
  const closedData = closedQuery.data;
  const bodyIssues = useMemo(() => (bodyFresh ? (bodyData ?? []) : []), [bodyFresh, bodyData]);
  const closedIssues = useMemo(
    () => (includeClosed && closedFresh ? (closedData ?? []) : []),
    [includeClosed, closedFresh, closedData],
  );

  // ─── Direct key lookup (D-17): local index first, network only on miss ─────

  const localDirect = resolvedKeyLookup ? findIndexEntry(index, resolvedKeyLookup) : null;
  const keyQuery = useQuery({
    queryKey: ['search', 'key', resolvedKeyLookup],
    queryFn: async () => {
      const token = await readSecret('jira-pat');
      return fetchJiraIssueByKey(jiraBaseUrl ?? '', token, resolvedKeyLookup);
    },
    enabled:
      open &&
      resolvedKeyLookup.length > 0 &&
      trimmed.length >= 2 &&
      !localDirect &&
      !isIndexLoading &&
      !!jiraBaseUrl &&
      !!activeJiraProject,
    staleTime: 30_000,
  });
  const directEntry = useMemo(() => {
    if (localDirect) return localDirect;
    if (resolvedKeyLookup && keyQuery.data) {
      return entryFromJiraIssue(keyQuery.data, index, epicLinkFieldKey, 'open');
    }
    return null;
  }, [localDirect, resolvedKeyLookup, keyQuery.data, index, epicLinkFieldKey]);

  // ─── Ranked result model ───────────────────────────────────────────────────

  const sections = useMemo(() => {
    const model = buildResultModel({
      index,
      query: trimmed,
      bodyIssues,
      closedIssues,
      includeClosed,
      expandedTiers,
      epicLinkFieldKey,
    });
    const directKey = directEntry?.key;
    return model
      .map((sec) => ({
        ...sec,
        rows: directKey ? sec.rows.filter((r) => r.entry.key !== directKey) : sec.rows,
      }))
      .filter((sec) => sec.rows.length > 0 || sec.hiddenCount > 0);
  }, [
    index,
    trimmed,
    bodyIssues,
    closedIssues,
    includeClosed,
    expandedTiers,
    epicLinkFieldKey,
    directEntry,
  ]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleIssueSelect(issueKey: string) {
    // Recent-item tracking is owned by IssueDetailView's effect once the full-page view loads.
    // Pushing here would race with the authoritative push (which has the real title from the API).
    onIssueClick?.(issueKey);
    onClose();
  }

  /** clicking the issue key element also navigates full-page and closes the palette. */
  function handleIssueKeyClick(e: React.MouseEvent, issueKey: string) {
    e.stopPropagation();
    // Recent-item tracking is owned by handleIssueClick in main.tsx (authoritative push with
    // cache-resolved title). Pushing here would be a redundant, potentially lower-quality push.
    onIssueClick?.(issueKey);
    onClose();
  }

  function handleMRSelect(mr: GitLabMR) {
    pushRecentItem({ type: 'gitlab', id: `${mr.project_id}/${mr.iid}`, title: mr.title });
    onNavigate(`/mr/${mr.project_id}/${mr.iid}`);
    onClose();
  }

  function handleToggleTheme() {
    const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    applyTheme(nextTheme);
    setTheme(nextTheme);
    saveTheme(nextTheme);
    onClose();
  }

  function handleMarkAllRead() {
    useNotificationsStore.getState().markAllRead();
    onClose();
  }

  function handleCreateIssue() {
    onOpenCreate();
    onClose();
  }

  // ─── Helpers for recent items display ──────────────────────────────────────

  function getRecentItemLabel(item: { type: 'jira' | 'gitlab'; id: string; title?: string }) {
    if (item.type === 'jira') {
      const cached = findIndexEntry(index, item.id);
      const title = cached?.summary ?? cachedIssuesMap.get(item.id)?.fields.summary ?? item.title;
      return title ? `${item.id} ${title}` : item.id;
    }
    // GitLab ids are stored as "project_id/iid" (composite). Split to get the bare iid for
    // display (e.g. "!67" instead of "!12345/67") and for cache lookup.
    const iid = item.id.includes('/') ? item.id.split('/').pop() : item.id;
    const cachedMR = allMRs.find((mr) => String(mr.iid) === iid);
    const title = cachedMR?.title ?? item.title;
    return title ? `!${iid} ${title}` : `!${iid}`;
  }

  /** Resolve the icon type name for a recent Jira item: sprint-board cache first, then the
   * persisted `issueType`, matching RecentItemsPopover.tsx's cache-then-persisted resolution. */
  function getRecentItemTypeName(item: { id: string; issueType?: string }) {
    return (
      findIndexEntry(index, item.id)?.typeName ??
      cachedIssuesMap.get(item.id)?.fields.issuetype?.name ??
      item.issueType
    );
  }

  // ─── Navigation action handlers (for action-based nav items like notifications) ─
  const navActionHandlers: Record<string, () => void> = {
    'open-notifications': () => {
      onOpenNotifications();
      onClose();
    },
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!open) return null;

  const isDefaultState = query.length < 2;

  const visibleMRs = isDefaultState
    ? []
    : allMRs.filter((mr) => matchesSecondary(trimmed, mr.title, `!${mr.iid}`));
  const visibleNav = NAV_SHORTCUTS.filter(
    (s) => isDefaultState || matchesSecondary(trimmed, s.navMeta.label),
  );
  const actionItems = [
    {
      value: 'action:create-issue',
      label: 'Create issue',
      keywords: ['new', 'add', 'create', 'issue', 'task', 'ticket'],
      run: handleCreateIssue,
    },
    {
      value: 'action:toggle-theme',
      label: 'Toggle theme',
      keywords: ['theme', 'dark', 'light', 'appearance'],
      run: handleToggleTheme,
    },
    {
      value: 'action:mark-read',
      label: 'Mark all notifications read',
      keywords: ['notification', 'unread', 'clear'],
      run: handleMarkAllRead,
    },
  ].filter((a) => isDefaultState || matchesSecondary(trimmed, a.label, ...a.keywords));

  const keyFetching = keyQuery.isFetching;
  const bodyFetching = bodyQuery.isFetching;
  const closedFetching = includeClosed && closedQuery.isFetching;
  const anyFetching = bodyFetching || closedFetching || keyFetching;
  const hasIssueRows = sections.some((sec) => sec.rows.length > 0);
  const showEmpty =
    !isDefaultState &&
    !directEntry &&
    !hasIssueRows &&
    visibleMRs.length === 0 &&
    visibleNav.length === 0 &&
    actionItems.length === 0 &&
    !anyFetching &&
    !isIndexLoading &&
    !isIndexError;
  const hasClosedSection = sections.some((sec) => sec.tier.id === 'closed');

  function renderIssueRow(row: ResultRow, itemKey: string) {
    const e = row.entry;
    return (
      <CommandItem
        key={itemKey}
        value={e.key}
        onSelect={() => handleIssueSelect(e.key)}
        className="py-1 [&>svg:last-child]:hidden"
      >
        <SearchResultRow
          issueKey={e.key}
          title={e.summary}
          titleRanges={row.titleRanges}
          typeName={e.typeName}
          statusName={e.statusName}
          statusCategoryKey={e.statusCategoryKey}
          epic={e.epic}
          showEpic={!e.isSubtask && !e.isEpic}
          assigneeName={e.assigneeName}
          avatarUrl={e.avatarUrl}
          snippet={row.snippet}
          matchTag={row.tag}
          dimmed={row.dimmed}
          indent={row.indent}
          onKeyClick={handleIssueKeyClick}
        />
      </CommandItem>
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: full-screen backdrop overlay; role=button is intentional for Escape/Enter dismiss
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation-stopper for palette content panel */}
      <div
        className="max-w-3xl mt-16 mx-4 sm:mx-auto"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Let Escape keep bubbling to document so the react-hotkeys-hook
          // listener above (and the backdrop's own Escape handler) still
          // close the palette -- only contain other keys (space/enter from
          // typing in the search input) so they don't reach the backdrop's
          // onClick/onKeyDown dismiss handlers.
          if (e.key === 'Escape') return;
          e.stopPropagation();
        }}
      >
        <Command
          shouldFilter={false}
          loop
          value={selectedValue}
          onValueChange={setSelectedValue}
          className="rounded-lg border shadow-lg bg-popover"
        >
          <CommandInput
            placeholder="Search issues, MRs, and actions..."
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          {(bodyFetching || closedFetching) && (
            <div className="h-0.5 bg-primary/30 animate-pulse motion-reduce:animate-none" />
          )}
          <CommandList ref={listRef} className="max-h-[70vh] scroll-py-1">
            {showEmpty && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <SearchX className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different term, a key like ESHOP-412, or include closed issues.
                </p>
              </div>
            )}

            {isDefaultState ? (
              <CommandGroup heading="Recent Items">
                {recentItems.length === 0 ? (
                  <CommandItem disabled>No recent items</CommandItem>
                ) : (
                  recentItems.map((item) => {
                    const resolvedTypeName =
                      item.type === 'jira' ? getRecentItemTypeName(item) : undefined;
                    return (
                      <CommandItem
                        key={`${item.type}-${item.id}`}
                        value={`${item.type}-${item.id}`}
                        keywords={[item.id]}
                        onSelect={() => {
                          if (item.type === 'jira') {
                            handleIssueSelect(item.id);
                          } else {
                            pushRecentItem({ type: 'gitlab', id: item.id, title: item.title });
                            onNavigate(`/mr/${item.id}`);
                            onClose();
                          }
                        }}
                      >
                        {item.type === 'jira' ? (
                          resolvedTypeName ? (
                            <IssueTypeIcon
                              typeName={resolvedTypeName}
                              className="w-3.5 h-3.5 shrink-0"
                            />
                          ) : (
                            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                          )
                        ) : (
                          <GitMerge className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{getRecentItemLabel(item)}</span>
                      </CommandItem>
                    );
                  })
                )}
              </CommandGroup>
            ) : (
              <>
                {/* Direct match (D-17): pinned above the tiers */}
                {directEntry ? (
                  <CommandGroup heading="Direct match">
                    {renderIssueRow(
                      {
                        entry: directEntry,
                        field: 0,
                        titleRanges: [],
                        snippet: null,
                        tag: null,
                        dimmed: false,
                        indent: false,
                      },
                      `direct-${directEntry.key}`,
                    )}
                  </CommandGroup>
                ) : (
                  keyFetching && (
                    <CommandGroup heading="Direct match">
                      <Skeleton className="h-8 rounded" />
                    </CommandGroup>
                  )
                )}

                {isIndexLoading && (
                  <div className="flex flex-col gap-2 p-2">
                    <p className="text-xs text-muted-foreground">Loading issues…</p>
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-6 rounded" />
                    ))}
                  </div>
                )}
                {isIndexError && !isIndexLoading && (
                  <p className="p-2 text-xs text-muted-foreground">
                    Couldn't load issues. Check your Jira connection and reopen search.
                  </p>
                )}

                {/* Ranked tiers (D-06) */}
                {sections.map((sec) => (
                  <CommandGroup key={sec.tier.id} heading={sec.tier.label}>
                    {sec.rows.map((row) => renderIssueRow(row, row.entry.key))}
                    {sec.hiddenCount > 0 && (
                      <CommandItem
                        value={`more:${sec.tier.id}`}
                        onSelect={() => setExpandedTiers((prev) => new Set(prev).add(sec.tier.id))}
                        className="py-1 text-xs text-muted-foreground"
                      >
                        +{sec.hiddenCount} more in {sec.tier.label}
                      </CommandItem>
                    )}
                  </CommandGroup>
                ))}

                {closedFetching && !hasClosedSection && (
                  <CommandGroup heading="Closed">
                    <div className="flex flex-col gap-2 p-1">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-6 rounded" />
                      ))}
                    </div>
                  </CommandGroup>
                )}

                {bodyQuery.isError && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Couldn't search descriptions and comments. Showing title matches only.
                  </div>
                )}

                {/* D-15: opt-in closed issues */}
                {!includeClosed && (
                  <CommandItem
                    value="include-closed"
                    onSelect={() => setIncludeClosed(true)}
                    className="text-muted-foreground"
                  >
                    <Archive className="size-3.5" />
                    Include closed issues
                  </CommandItem>
                )}

                {/* D-16: Merge Requests below the issue tiers, query-filtered */}
                {visibleMRs.length > 0 && (
                  <CommandGroup heading="Merge Requests">
                    {visibleMRs.map((mr) => (
                      <CommandItem
                        key={mr.iid}
                        value={`mr:${mr.project_id}/${mr.iid}`}
                        onSelect={() => handleMRSelect(mr)}
                      >
                        <GitMerge className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">!{mr.iid}</span>
                        <span className="truncate">{mr.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}

            {/* Navigation group -- dynamically derived from shortcuts registry (NAV_SHORTCUTS) */}
            {visibleNav.length > 0 && (
              <CommandGroup heading="Navigation">
                {visibleNav.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`nav:${s.id}`}
                    onSelect={
                      s.navMeta.route
                        ? () => {
                            onNavigate(s.navMeta.route ?? '');
                            onClose();
                          }
                        : () => {
                            navActionHandlers[s.navMeta.action ?? '']?.();
                          }
                    }
                  >
                    {s.navMeta.label}
                    <CommandShortcut>{s.defaultKey}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {actionItems.length > 0 && (
              <CommandGroup heading="Actions">
                {actionItems.map((a) => (
                  <CommandItem key={a.value} value={a.value} onSelect={a.run}>
                    {a.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
