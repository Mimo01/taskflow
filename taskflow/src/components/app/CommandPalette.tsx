/**
 * CommandPalette -- full command palette overlay with fuzzy search, grouped results,
 * navigation/action items, live Jira search tail item, and recent items default state.
 *
 * Replaces SearchOverlay as the single search entry point.
 * Built with shadcn Command (cmdk) primitives -- NOT CommandDialog (Radix Dialog conflicts
 * with @base-ui/react).
 *
 * Groups:
 *   Default state (<2 chars): Recent Items, Navigation
 *   Search state (>=2 chars): Issues, Merge Requests, Navigation, Actions, + "Search Jira" tail
 */

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { NAV_SHORTCUTS } from '@/lib/shortcuts';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { searchJira } from '@/services/jira';
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
  onIssueClick: (issueKey: string) => void;
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
  const [liveSearchTriggered, setLiveSearchTriggered] = useState(false);

  const queryClient = useQueryClient();
  const { storyPointsFieldKey, theme, setTheme } = useSettingsStore();
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem);
  const recentItems = useRecentItemsStore((s) => s.items);

  // KEYS migration: all keyboard shortcuts use react-hotkeys-hook (no raw window listeners)
  // enableOnFormTags: true is intentional -- Escape must close the palette even while typing
  useHotkeys('escape', onClose, { enableOnFormTags: true, enabled: open });

  // Reset state when palette closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setLiveSearchTriggered(false);
    }
  }, [open]);

  // ─── Cached data access (NO API calls for cached results) ──────────────────

  const cachedMyTasks = queryClient.getQueryData<{ issues: JiraIssue[] }>([
    'jira-issues',
    'my-tasks',
    activeJiraProject,
    storyPointsFieldKey,
  ]);
  const cachedSprintBoard = queryClient.getQueryData<{ issues: JiraIssue[] }>([
    'jira-issues',
    'sprint-board',
    activeJiraProject,
    storyPointsFieldKey,
  ]);

  // Deduplicate issues by key using a Map: merge my-tasks + sprint-board, keep first occurrence
  const issuesMap = new Map<string, JiraIssue>();
  for (const issue of cachedMyTasks?.issues ?? []) {
    if (!issuesMap.has(issue.key)) issuesMap.set(issue.key, issue);
  }
  for (const issue of cachedSprintBoard?.issues ?? []) {
    if (!issuesMap.has(issue.key)) issuesMap.set(issue.key, issue);
  }
  const allIssues = Array.from(issuesMap.values());

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

  // ─── Live Jira search ──────────────────────────────────────────────────────

  const { data: liveResults, isLoading: liveSearchLoading } = useQuery({
    queryKey: ['search', 'live', query],
    queryFn: async () => {
      const token = await readSecret('jira-pat');
      return searchJira(jiraBaseUrl!, token, activeJiraProject!, query);
    },
    enabled: query.length >= 2 && liveSearchTriggered && !!jiraBaseUrl && !!activeJiraProject,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleIssueSelect(issueKey: string, title?: string) {
    const resolvedTitle = title ?? issuesMap.get(issueKey)?.fields.summary;
    pushRecentItem({ type: 'jira', id: issueKey, title: resolvedTitle });
    onIssueClick(issueKey);
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

  function handleLiveSearch() {
    setLiveSearchTriggered(true);
  }

  // ─── Helpers for recent items display ──────────────────────────────────────

  function getRecentItemLabel(item: { type: 'jira' | 'gitlab'; id: string; title?: string }) {
    if (item.type === 'jira') {
      const cached = issuesMap.get(item.id);
      const title = cached?.fields.summary ?? item.title;
      return title ? `${item.id} ${title}` : item.id;
    }
    const cachedMR = allMRs.find((mr) => String(mr.iid) === item.id);
    const title = cachedMR?.title ?? item.title;
    return title ? `!${item.id} ${title}` : `!${item.id}`;
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

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="max-w-xl mt-16 mx-auto" onClick={(e) => e.stopPropagation()}>
        <Command className="rounded-lg border shadow-lg bg-popover">
          <CommandInput
            placeholder="Search issues, MRs, and actions..."
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="flex flex-col items-center justify-center py-6 text-center">
              <SearchX className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different search term or check your spelling
              </p>
            </CommandEmpty>

            {isDefaultState ? (
              <>
                {/* Recent Items group -- only in default state */}
                <CommandGroup heading="Recent Items">
                  {recentItems.length === 0 ? (
                    <CommandItem disabled>No recent items</CommandItem>
                  ) : (
                    recentItems.map((item) => (
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
                        {getRecentItemLabel(item)}
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </>
            ) : (
              <>
                {/* Issues group -- only in search state */}
                <CommandGroup heading="Issues">
                  {allIssues.map((issue) => (
                    <CommandItem
                      key={issue.key}
                      value={`${issue.key} ${issue.fields.summary}`}
                      onSelect={() => handleIssueSelect(issue.key)}
                    >
                      <span className="text-muted-foreground font-mono">{issue.key}</span>
                      <span className="truncate">{issue.fields.summary}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {/* Merge Requests group -- only in search state */}
                <CommandGroup heading="Merge Requests">
                  {allMRs.map((mr) => (
                    <CommandItem
                      key={mr.iid}
                      value={`!${mr.iid} ${mr.title}`}
                      onSelect={() => handleMRSelect(mr)}
                    >
                      <span className="text-muted-foreground">!{mr.iid}</span>
                      <span className="truncate">{mr.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {/* Live search tail item -- only in search state */}
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    forceMount
                    onSelect={handleLiveSearch}
                    value="search-jira-live-query"
                  >
                    Search Jira for &ldquo;{query}&rdquo;
                  </CommandItem>
                </CommandGroup>

                {/* Live search results -- only in search state */}
                {liveSearchTriggered && liveSearchLoading && (
                  <div className="flex flex-col gap-2 p-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-9 rounded bg-muted animate-pulse" />
                    ))}
                  </div>
                )}
                {liveSearchTriggered && liveResults && liveResults.length > 0 && (
                  <CommandGroup heading="Jira Search Results">
                    {liveResults.map((issue) => (
                      <CommandItem
                        key={`live-${issue.key}`}
                        value={`live-${issue.key} ${issue.fields.summary}`}
                        onSelect={() => handleIssueSelect(issue.key, issue.fields.summary)}
                      >
                        <span className="text-muted-foreground font-mono">{issue.key}</span>
                        <span className="truncate">{issue.fields.summary}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}

            {/* Navigation group -- dynamically derived from shortcuts registry (NAV_SHORTCUTS) */}
            <CommandGroup heading="Navigation">
              {NAV_SHORTCUTS.map((s) => (
                <CommandItem
                  key={s.id}
                  onSelect={
                    s.navMeta.route
                      ? () => {
                          onNavigate(s.navMeta.route!);
                          onClose();
                        }
                      : () => {
                          navActionHandlers[s.navMeta.action!]?.();
                        }
                  }
                >
                  {s.navMeta.label}
                  <CommandShortcut>{s.defaultKey}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Actions group -- always rendered; only visible when cmdk matches keywords */}
            <CommandGroup heading="Actions">
              <CommandItem
                value="create issue"
                keywords={['new', 'add', 'create', 'issue', 'task', 'ticket']}
                onSelect={handleCreateIssue}
              >
                Create issue
              </CommandItem>
              <CommandItem
                value="toggle theme"
                keywords={['theme', 'dark', 'light', 'appearance']}
                onSelect={handleToggleTheme}
              >
                Toggle theme
              </CommandItem>
              <CommandItem
                value="mark all notifications read"
                keywords={['notification', 'unread', 'clear']}
                onSelect={handleMarkAllRead}
              >
                Mark all notifications read
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
