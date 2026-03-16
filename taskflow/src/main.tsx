import './index.css';
import React, { useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { KeyboardShortcutsPanel } from './components/app/KeyboardShortcutsPanel';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Outlet, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { loadTheme, applyDensity } from './services/theme';
import { useSettingsStore } from './stores/settings.store';
import { useAuthStore } from './stores/auth.store';
import Sidebar from './components/app/Sidebar';
import ReAuthBanner, { GitLabReAuthBanner } from './components/app/ReAuthBanner';
import TopBar from './components/app/TopBar';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import { readSecret } from './services/stronghold';
import { discoverCustomFields } from './services/jira';
import { IssueDetailSheet } from './routes/dashboard/IssueDetailSheet';
import { CreateEditIssueModal, type EditInitialValues } from './routes/dashboard/CreateEditIssueModal';
import CommandPalette from './components/app/CommandPalette';
import PinnedTabStrip from './components/app/PinnedTabStrip';
import { useRecentItemsStore } from './stores/recent-items.store';
import { usePinnedTabsStore } from './stores/pinned-tabs.store';
import Onboarding from './routes/onboarding/index';
import Dashboard from './routes/dashboard/index';
import Settings from './routes/settings/index';
import MyTasksTab from './routes/dashboard/MyTasksTab';
import SprintBoardTab from './routes/dashboard/SprintBoardTab';
import MrAttentionTab from './routes/dashboard/MrAttentionTab';
import SprintProgressTab from './routes/dashboard/SprintProgressTab';
import WorkloadTab from './routes/dashboard/WorkloadTab';
import ReleasesTab from './routes/dashboard/ReleasesTab';
import BacklogPage from './routes/dashboard/BacklogPage';
import EpicsPage from './routes/dashboard/EpicsPage';
import DebugLogs from './routes/debug-logs/index';
import ErrorPage from './routes/error/ErrorPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Runs discoverCustomFields once when Jira credentials first become available.
 * Resolves all four instance-specific custom field IDs in a single API call and
 * caches them in the settings store for use by all subsequent queries.
 * staleTime: Infinity — field keys do not change without a Jira admin action.
 */
function useCustomFieldDiscovery() {
  const { jiraConnected, jiraBaseUrl } = useAuthStore();
  const { setStoryPointsFieldKey, setEpicLinkFieldKey, setEpicNameFieldKey, setSprintFieldKey } = useSettingsStore();

  const query = useQuery({
    queryKey: ['jira-custom-fields', jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return null;
      return discoverCustomFields(jiraBaseUrl, token);
    },
    staleTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraConnected,
  });

  useEffect(() => {
    if (query.data) {
      setStoryPointsFieldKey(query.data.storyPointsFieldKey);
      setEpicLinkFieldKey(query.data.epicLinkFieldKey);
      setEpicNameFieldKey(query.data.epicNameFieldKey);
      setSprintFieldKey(query.data.sprintFieldKey);
    }
  }, [query.data, setStoryPointsFieldKey, setEpicLinkFieldKey, setEpicNameFieldKey, setSprintFieldKey]);
}

/**
 * AppLayout — renders Sidebar + main content when user has completed onboarding.
 * Shows ReAuthBanner if jiraConnected is false but onboarding is complete.
 *
 * Owns global selectedIssueKey state so IssueDetailSheet is accessible from
 * any entry point in the app (search results, notifications, sprint board,
 * my tasks, dashboard panels) without nesting sheets.
 */
function AppLayout() {
  const { onboardingComplete } = useSettingsStore();
  const { jiraConnected, gitlabConnected, _hasHydrated } = useAuthStore();
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalMode, setCreateModalMode] = useState<'create' | 'edit'>('create');
  const [createModalInitialValues, setCreateModalInitialValues] = useState<EditInitialValues | undefined>(undefined);
  const [createModalDefaultType, setCreateModalDefaultType] = useState<'Story' | 'Subtask' | 'Bug' | undefined>(undefined);
  const [createModalDefaultParent, setCreateModalDefaultParent] = useState<string | undefined>(undefined);
  const wasStoryCreate = useRef(false);
  const queryClient = useQueryClient();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const navigate = useNavigate();
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem);
  const pinnedKeys = usePinnedTabsStore((s) => s.pinnedKeys);
  const removePin = usePinnedTabsStore((s) => s.removePin);
  const reorderPins = usePinnedTabsStore((s) => s.reorder);
  const isPinned = usePinnedTabsStore((s) => selectedIssueKey ? s.pinnedKeys.includes(selectedIssueKey) : false);
  const togglePin = usePinnedTabsStore((s) => s.togglePin);

  // KEYS-01: mod+slash (Cmd+/ on macOS, Ctrl+/ elsewhere) opens shortcuts panel — uses code name to bypass react-hotkeys-hook #1125
  // KEYS-07: enableOnFormTags defaults to false — mod+slash in an input does NOT open the panel
  useHotkeys('mod+slash', () => setShortcutsOpen(true));

  // PALETTE-01: Cmd+K opens command palette
  useHotkeys('mod+k', (e) => { e.preventDefault(); setPaletteOpen(true); });

  // KEYS-03: Navigation shortcuts
  useHotkeys('mod+shift+s', () => navigate('/sprint-board'));
  useHotkeys('mod+shift+b', () => navigate('/backlog'));
  useHotkeys('mod+shift+n', () => setNotifPopoverOpen(true));
  useHotkeys('mod+comma', () => navigate('/settings'));

  // Listen for all native menu bar item clicks and route to existing handlers
  const debugMode = useSettingsStore((s) => s.debugMode);
  useEffect(() => {
    const listeners = [
      listen('menu-keyboard-shortcuts', () => setShortcutsOpen(true)),
      listen('menu-command-palette', () => setPaletteOpen(true)),
      listen('menu-nav-sprint', () => navigate('/sprint-board')),
      listen('menu-nav-backlog', () => navigate('/backlog')),
      listen('menu-nav-notifications', () => setNotifPopoverOpen(true)),
      listen('menu-nav-settings', () => navigate('/settings')),
      listen('menu-debug-logs', () => navigate('/debug-logs')),
    ];
    return () => { listeners.forEach((p) => p.then((fn) => fn())); };
  }, []);

  // Show/hide Debug menu in native toolbar when debugMode changes
  useEffect(() => {
    invoke('toggle_debug_menu', { enabled: debugMode }).catch(() => {});
  }, [debugMode]);

  // Track recent items whenever an issue is opened from any entry point
  const handleIssueClick = (issueKey: string) => {
    setSelectedIssueKey(issueKey);

    // Resolve title from react-query cache for recent-items store.
    // Cache shapes vary: sprint-board is flat JiraIssue[], my-tasks is { issues: JiraIssue[] },
    // backlog is { sprints: [{ issues }], backlog: JiraIssue[] }, epics is EpicEnriched[],
    // issue-detail is a single JiraIssueDetail object.
    let resolvedTitle: string | undefined;

    type CachedIssue = { key: string; fields: { summary: string } };

    // Helper: search an array of issues for a matching key
    const findTitle = (issues: CachedIssue[] | undefined) =>
      issues?.find((i) => i.key === issueKey)?.fields.summary;

    // 1. Search all jira-issues caches (sprint-board = flat array, my-tasks = { issues: [] })
    const issueEntries = queryClient.getQueriesData<CachedIssue[] | { issues?: CachedIssue[] }>({
      queryKey: ['jira-issues'],
    });
    for (const [, data] of issueEntries) {
      if (!data) continue;
      // my-tasks shape: { issues: [...] }
      if ('issues' in data && Array.isArray(data.issues)) {
        resolvedTitle = findTitle(data.issues);
      } else if (Array.isArray(data)) {
        // sprint-board shape: flat JiraIssue[]
        resolvedTitle = findTitle(data);
      }
      if (resolvedTitle) break;
    }

    // 2. Search backlog cache (sprints[].issues + backlog[])
    if (!resolvedTitle) {
      const backlogEntries = queryClient.getQueriesData<{ sprints?: Array<{ issues: CachedIssue[] }>; backlog?: CachedIssue[] }>({
        queryKey: ['jira-backlog-view'],
      });
      for (const [, data] of backlogEntries) {
        if (!data) continue;
        resolvedTitle = findTitle(data.backlog);
        if (!resolvedTitle && data.sprints) {
          for (const s of data.sprints) {
            resolvedTitle = findTitle(s.issues);
            if (resolvedTitle) break;
          }
        }
        if (resolvedTitle) break;
      }
    }

    // 3. Search jira-epics-basic cache (flat array with summary at top level)
    if (!resolvedTitle) {
      const epicEntries = queryClient.getQueriesData<Array<{ key: string; summary: string }>>({
        queryKey: ['jira-epics-basic'],
      });
      for (const [, data] of epicEntries) {
        const match = data?.find((e) => e.key === issueKey);
        if (match) { resolvedTitle = match.summary; break; }
      }
    }

    // 4. Check jira-issue-detail cache (single issue, key includes baseUrl)
    if (!resolvedTitle) {
      const detailEntries = queryClient.getQueriesData<CachedIssue>({
        queryKey: ['jira-issue-detail', issueKey],
      });
      for (const [, data] of detailEntries) {
        if (data?.fields?.summary) { resolvedTitle = data.fields.summary; break; }
      }
    }

    pushRecentItem({ type: 'jira', id: issueKey, title: resolvedTitle });
  };

  const handlePaletteNavigate = (path: string) => {
    navigate(path);
  };

  const handlePaletteOpenNotifications = () => {
    setNotifPopoverOpen(true);
  };

  const handleOpenCreate = () => {
    wasStoryCreate.current = false;
    setCreateModalMode('create');
    setCreateModalInitialValues(undefined);
    setCreateModalDefaultType(undefined);
    setCreateModalDefaultParent(undefined);
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (vals: EditInitialValues) => {
    wasStoryCreate.current = false;
    setCreateModalMode('edit');
    setCreateModalInitialValues(vals);
    setCreateModalDefaultType(undefined);
    setCreateModalDefaultParent(undefined);
    setCreateModalOpen(true);
  };

  const handleOpenAddSubtask = (parentKey: string) => {
    wasStoryCreate.current = false;
    setCreateModalMode('create');
    setCreateModalDefaultType('Subtask');
    setCreateModalDefaultParent(parentKey);
    setCreateModalInitialValues(undefined);
    setCreateModalOpen(true);
  };

  const handleOpenCreateStory = () => {
    wasStoryCreate.current = true;
    setCreateModalMode('create');
    setCreateModalDefaultType('Story');
    setCreateModalInitialValues(undefined);
    setCreateModalDefaultParent(undefined);
    setCreateModalOpen(true);
  };

  const handleCreateModalClose = () => {
    if (wasStoryCreate.current) {
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-view'] });
    }
    wasStoryCreate.current = false;
    setCreateModalOpen(false);
  };

  // Bring window to front when OS notification click activates the app
  useEffect(() => {
    getCurrentWindow().setFocus().catch(() => {});
  }, []);

  // Notification polling — runs inside QueryClientProvider context
  useNotificationPolling();
  useCustomFieldDiscovery();

  if (!onboardingComplete) {
    // During onboarding, no sidebar
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onOpenCreate={handleOpenCreate} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar
          onIssueClick={handleIssueClick}
          paletteOpen={paletteOpen}
          onPaletteOpen={() => setPaletteOpen(true)}
          notifPopoverOpen={notifPopoverOpen}
          onNotifPopoverChange={setNotifPopoverOpen}
        />
        {pinnedKeys.length > 0 && (
          <PinnedTabStrip
            pinnedKeys={pinnedKeys}
            activeKey={selectedIssueKey}
            onTabClick={handleIssueClick}
            onTabClose={removePin}
            onReorder={reorderPins}
          />
        )}
        {_hasHydrated && !jiraConnected && <ReAuthBanner />}
        {_hasHydrated && !gitlabConnected && <GitLabReAuthBanner />}
        <main className="flex-1 overflow-auto">
          <Outlet context={{ onIssueClick: handleIssueClick, onEpicClick: handleIssueClick, openEdit: handleOpenEdit, openAddSubtask: handleOpenAddSubtask, openCreateStory: handleOpenCreateStory, selectedIssueKey }} />
        </main>
      </div>
      {/* Command palette overlay */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onIssueClick={(key) => { handleIssueClick(key); setPaletteOpen(false); }}
        onNavigate={handlePaletteNavigate}
        onOpenNotifications={handlePaletteOpenNotifications}
        onOpenCreate={handleOpenCreate}
      />
      {/* Global IssueDetailSheet — accessible from search, notifications, and all route views */}
      <IssueDetailSheet
        issueKey={selectedIssueKey}
        onClose={() => setSelectedIssueKey(null)}
        onOpenIssue={handleIssueClick}
        onEdit={handleOpenEdit}
        onAddSubtask={handleOpenAddSubtask}
        isPinned={isPinned}
        onTogglePin={togglePin}
      />
      <CreateEditIssueModal
        open={createModalOpen}
        onClose={handleCreateModalClose}
        mode={createModalMode}
        initialValues={createModalInitialValues}
        defaultIssueType={createModalDefaultType}
        defaultParentKey={createModalDefaultParent}
      />
      <KeyboardShortcutsPanel
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

const router = createHashRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Onboarding /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/settings', element: <Settings /> },
      { path: '/my-tasks', element: <MyTasksTab /> },
      { path: '/sprint-board', element: <SprintBoardTab /> },
      { path: '/backlog', element: <BacklogPage /> },
      { path: '/epics', element: <EpicsPage /> },
      { path: '/mr-attention', element: <MrAttentionTab /> },
      { path: '/sprint-progress', element: <SprintProgressTab /> },
      { path: '/workload', element: <WorkloadTab /> },
      { path: '/releases', element: <ReleasesTab /> },
      { path: '/debug-logs', element: <DebugLogs /> },
    ],
  },
]);

// Apply persisted theme BEFORE first render to avoid flash of wrong theme.
// loadTheme() falls back to 'system' if no preference is saved.
// applyDensity('default') sets the density baseline synchronously — no flash
// because 'default' means no data-density attribute (CSS baseline sizing).
// After hydration, AppearanceSection's useEffect will apply the stored density.
applyDensity('default');
loadTheme().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
