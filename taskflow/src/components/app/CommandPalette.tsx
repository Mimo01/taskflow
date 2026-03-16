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
import { useState, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { applyTheme, saveTheme, type Theme } from '@/services/theme';
import { readSecret } from '@/services/stronghold';
import { searchJira } from '@/services/jira';
import type { JiraIssue } from '@/services/jira';
import type { GitLabMR } from '@/services/gitlab';

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
    pushRecentItem({ type: 'gitlab', id: String(mr.iid), url: mr.web_url, title: mr.title });
    openUrl(mr.web_url);
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

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!open) return null;

  const isDefaultState = query.length < 2;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-w-xl mt-16 mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="rounded-lg border shadow-lg bg-popover">
          <CommandInput
            placeholder="Search issues, MRs, and actions..."
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No matches -- try different keywords</CommandEmpty>

            {isDefaultState ? (
              <>
                {/* Recent Items group */}
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
                            pushRecentItem({ type: 'gitlab', id: item.id, url: item.url });
                            openUrl(item.url!);
                            onClose();
                          }
                        }}
                      >
                        {getRecentItemLabel(item)}
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>

                {/* Navigation group */}
                <CommandGroup heading="Navigation">
                  <CommandItem
                    onSelect={() => { onNavigate('/sprint-board'); onClose(); }}
                  >
                    Sprint Board
                    <CommandShortcut>⌘⇧S</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => { onNavigate('/backlog'); onClose(); }}
                  >
                    Backlog
                    <CommandShortcut>⌘⇧B</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => { onOpenNotifications(); onClose(); }}
                  >
                    Notifications
                    <CommandShortcut>⌘⇧N</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => { onNavigate('/settings'); onClose(); }}
                  >
                    Settings
                  </CommandItem>
                </CommandGroup>
              </>
            ) : (
              <>
                {/* Issues group */}
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

                {/* Merge Requests group */}
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

                {/* Navigation group */}
                <CommandGroup heading="Navigation">
                  <CommandItem
                    onSelect={() => { onNavigate('/sprint-board'); onClose(); }}
                  >
                    Sprint Board
                    <CommandShortcut>⌘⇧S</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => { onNavigate('/backlog'); onClose(); }}
                  >
                    Backlog
                    <CommandShortcut>⌘⇧B</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => { onOpenNotifications(); onClose(); }}
                  >
                    Notifications
                    <CommandShortcut>⌘⇧N</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => { onNavigate('/settings'); onClose(); }}
                  >
                    Settings
                  </CommandItem>
                </CommandGroup>

                {/* Actions group */}
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

                {/* Live search tail item */}
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

                {/* Live search results */}
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
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
