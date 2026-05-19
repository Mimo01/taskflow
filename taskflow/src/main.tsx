import './index.css';
import {
  QueryClient,
  QueryClientProvider,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  createHashRouter,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AboutDialog } from './components/about/AboutDialog';
import CommandPalette from './components/app/CommandPalette';
import { KeyboardShortcutsPanel } from './components/app/KeyboardShortcutsPanel';
import PinnedTabStrip from './components/app/PinnedTabStrip';
import ReAuthBanner, { GitLabReAuthBanner } from './components/app/ReAuthBanner';
import Sidebar from './components/app/Sidebar';
import TopBar from './components/app/TopBar';
import { HardMinimumOverlay } from './components/update/HardMinimumOverlay';
import { SoftMinimumBanner } from './components/update/SoftMinimumBanner';
import { UpdateDialog } from './components/update/UpdateDialog';
import { WhatsNewDialog } from './components/update/WhatsNewDialog';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import { useSavedFilterSync } from './hooks/useSavedFilterSync';
import { useUpdatePolling } from './hooks/useUpdatePolling';
import { useVersionPolicyCheck } from './hooks/useVersionPolicyCheck';
import {
  CreateEditIssueModal,
  type EditInitialValues,
} from './routes/dashboard/CreateEditIssueModal';
import ErrorPage from './routes/error/ErrorPage';
import { routes } from './routes/routes';
import { initAvatarCache } from './services/avatarCache';
import { discoverCustomFields, fetchIssueSummary } from './services/jira';
import { readSecret } from './services/stronghold';
import { applyDensity, loadTheme } from './services/theme';
import { updaterService } from './services/updater';
import { useAuthStore } from './stores/auth.store';
import { useBreadcrumbStore } from './stores/breadcrumb.store';
import { usePinnedTabsStore } from './stores/pinned-tabs.store';
import { useRecentItemsStore } from './stores/recent-items.store';
import { useSettingsStore } from './stores/settings.store';
import { useUpdateStore } from './stores/update.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: Infinity, // never evict cache during session (LOAD-02)
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
  const {
    setStoryPointsFieldKey,
    setEpicLinkFieldKey,
    setEpicNameFieldKey,
    setSprintFieldKey,
    setEpicColorFieldKey,
    setFlaggedFieldKey,
  } = useSettingsStore();

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
      setEpicColorFieldKey(query.data.epicColorFieldKey);
      setFlaggedFieldKey(query.data.flaggedFieldKey);
    }
  }, [
    query.data,
    setStoryPointsFieldKey,
    setEpicLinkFieldKey,
    setEpicNameFieldKey,
    setSprintFieldKey,
    setEpicColorFieldKey,
    setFlaggedFieldKey,
  ]);
}

/**
 * AppLayout — renders Sidebar + main content when user has completed onboarding.
 * Shows ReAuthBanner if jiraConnected is false but onboarding is complete.
 *
 * Issue clicks navigate to /issue/:key route (full-page detail view).
 * All app chrome (Sidebar, TopBar, PinnedTabStrip) remains visible.
 */
function AppLayout() {
  const { onboardingComplete } = useSettingsStore();
  const { jiraConnected, jiraBaseUrl, gitlabConnected, _hasHydrated } = useAuthStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalMode, setCreateModalMode] = useState<'create' | 'edit'>('create');
  const [createModalInitialValues, setCreateModalInitialValues] = useState<
    EditInitialValues | undefined
  >(undefined);
  const [createModalDefaultType, setCreateModalDefaultType] = useState<
    'Story' | 'Subtask' | 'Bug' | undefined
  >(undefined);
  const [createModalDefaultParent, setCreateModalDefaultParent] = useState<string | undefined>(
    undefined,
  );
  const wasStoryCreate = useRef(false);
  const queryClient = useQueryClient();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem);
  const pinnedKeys = usePinnedTabsStore((s) => s.pinnedKeys);
  const removePin = usePinnedTabsStore((s) => s.removePin);
  const reorderPins = usePinnedTabsStore((s) => s.reorder);
  const pinnedCycleMeta = usePinnedTabsStore((s) => s.pinnedCycleMeta);
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const breadcrumbReset = useBreadcrumbStore((s) => s.reset);

  // Version policy enforcement (D-12–D-16)
  const { softMinimumActive, hardMinimumActive, policy } = useVersionPolicyCheck();
  const [softNagDismissed, setSoftNagDismissed] = useState(false);

  // Triggered by SoftMinimumBanner "Update Now" — initiates update check flow
  const handleBannerUpdate = async () => {
    const { setChecking, setAvailable, setError } = useUpdateStore.getState();
    setChecking();
    try {
      const info = await updaterService.check();
      if (info) setAvailable(info.version, info.body, info.date);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Split pinned keys: issue keys go through useQueries (API fetch), cycle keys read from store
  const issuePinnedKeys = pinnedKeys.filter((k) => !k.includes('-CY-'));
  const cyclePinnedKeys = pinnedKeys.filter((k) => k.includes('-CY-'));

  // Actively fetch summary+type for each pinned issue key so tabs load
  // independently on app start. Uses a lightweight 2-field endpoint.
  // staleTime matches the default 5-min window; gcTime: Infinity keeps
  // data around even when a tab is unpinned then re-pinned quickly.
  const pinnedQueries = useQueries({
    queries: issuePinnedKeys.map((issueKey) => ({
      queryKey: ['jira-pinned-summary', issueKey, jiraBaseUrl],
      queryFn: async () => {
        const token = await readSecret('jira-pat').catch(() => null);
        if (!token || !jiraBaseUrl) throw new Error('No credentials');
        return fetchIssueSummary(jiraBaseUrl, token, issueKey);
      },
      staleTime: 5 * 60 * 1000,
      gcTime: Infinity,
      enabled: !!jiraBaseUrl && !!jiraConnected,
    })),
  });

  // Local type aliases mirroring PinnedTabStrip's discriminated union (not exported from component)
  type IssueTab = { type: 'issue'; summary: string; issueTypeName: string };
  type CycleTab = { type: 'cycle'; name: string; projectKey: string };

  // Build a resolved map for PinnedTabStrip: key -> IssueTab | CycleTab
  const resolvedPinnedTabs = new Map<string, IssueTab | CycleTab>();

  // Issue tabs — index i aligns with issuePinnedKeys (not pinnedKeys)
  issuePinnedKeys.forEach((key, i) => {
    const data = pinnedQueries[i]?.data;
    if (data?.fields) {
      resolvedPinnedTabs.set(key, {
        type: 'issue',
        summary: data.fields.summary,
        issueTypeName: data.fields.issuetype.name,
      });
    }
  });

  // Cycle tabs — metadata read from store (always available at paint time)
  cyclePinnedKeys.forEach((key) => {
    const meta = pinnedCycleMeta[key];
    if (meta) {
      resolvedPinnedTabs.set(key, {
        type: 'cycle',
        name: meta.name,
        projectKey: meta.projectKey,
      });
    }
  });

  // KEYS-01: mod+slash (Cmd+/ on macOS, Ctrl+/ elsewhere) opens shortcuts panel — uses code name to bypass react-hotkeys-hook #1125
  // KEYS-07: enableOnFormTags defaults to false — mod+slash in an input does NOT open the panel
  useHotkeys('mod+slash', () => setShortcutsOpen(true));

  // PALETTE-01: Cmd+K opens command palette
  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    setPaletteOpen(true);
  });

  // KEYS-03: Navigation shortcuts
  useHotkeys('mod+shift+s', () => navigate('/sprint-board'));
  useHotkeys('mod+shift+b', () => navigate('/backlog'));
  useHotkeys('mod+shift+n', () => setNotifPopoverOpen((prev) => !prev));
  useHotkeys('mod+comma', () => navigate('/settings'));
  useHotkeys('mod+shift+d', () => navigate('/dev-tools'));

  // SIDEBAR: Cmd+B toggles sidebar collapsed/expanded
  const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);
  useHotkeys('mod+b', (e) => {
    e.preventDefault();
    toggleSidebarCollapsed();
  });

  // Listen for all native menu bar item clicks and route to existing handlers
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  useEffect(() => {
    const listeners = [
      listen('menu-keyboard-shortcuts', () => setShortcutsOpen(true)),
      listen('menu-command-palette', () => setPaletteOpen(true)),
      listen('menu-nav-sprint', () => navigate('/sprint-board')),
      listen('menu-nav-backlog', () => navigate('/backlog')),
      listen('menu-nav-notifications', () => setNotifPopoverOpen(true)),
      listen('menu-nav-settings', () => navigate('/settings')),
      listen('menu-dev-tools', () => navigate('/dev-tools')),
      listen('menu-about', () => setAboutOpen(true)),
    ];
    return () => {
      listeners.forEach((p) => {
        p.then((fn) => fn());
      });
    };
  }, [navigate]);

  // Show/hide Debug menu in native toolbar when devToolsEnabled changes
  useEffect(() => {
    invoke('toggle_debug_menu', { enabled: devToolsEnabled }).catch(() => {});
  }, [devToolsEnabled]);

  // Reset breadcrumb trail when navigating away from a "detail" route that
  // participates in the breadcrumb system. AIO cycle and run detail pages
  // (Plan 54-11) also render breadcrumbs sourced from the same store —
  // include `/aio-cycle/` so the trail is preserved on issue → cycle/run
  // navigation.
  useEffect(() => {
    if (
      !location.pathname.startsWith('/issue/') &&
      !location.pathname.startsWith('/mr/') &&
      !location.pathname.startsWith('/release/') &&
      !location.pathname.startsWith('/aio-cycle/')
    ) {
      breadcrumbReset();
    }
  }, [location.pathname, breadcrumbReset]);

  /** Maps pathname to a human-readable label for breadcrumb display. */
  function routeLabel(pathname: string): string {
    if (pathname.startsWith('/sprint-board')) return 'Sprint Board';
    if (pathname.startsWith('/backlog')) return 'Backlog';
    if (pathname.startsWith('/my-tasks')) return 'My Tasks';
    if (pathname.startsWith('/epics')) return 'Epics';
    if (pathname.startsWith('/dashboard')) return 'Overview';
    if (pathname.startsWith('/sprint-progress')) return 'Sprint Progress';
    if (pathname.startsWith('/workload')) return 'Workload';
    if (pathname.startsWith('/releases')) return 'Releases';
    if (pathname.startsWith('/issue/')) return 'Issue';
    if (pathname.startsWith('/merge-requests')) return 'Merge Requests';
    if (pathname.startsWith('/mr/')) return 'MR Detail';
    if (pathname.startsWith('/release/')) return 'Release';
    return 'Home';
  }

  // Derive active issue key from current URL for PinnedTabStrip highlight
  const activeIssueKey = location.pathname.startsWith('/issue/')
    ? location.pathname.replace('/issue/', '')
    : null;

  // Derive active cycle key from current URL: /aio-cycle/:projectKey/:cycleKey → index 3
  const activeCycleKey = location.pathname.startsWith('/aio-cycle/')
    ? (location.pathname.split('/')[3] ?? null)
    : null;

  // Navigate to full-page issue detail + track recent item.
  // Trail is managed in breadcrumb store (not location state) so it's
  // independent of browser history. resetTrail=true clears the trail
  // (used by pinned tabs, sidebar, command palette, notifications).
  const handleIssueClick = (issueKey: string, resetTrail = false) => {
    if (resetTrail) {
      breadcrumbReset();
    } else if (location.pathname.startsWith('/issue/')) {
      // Drilling issue→issue — push current issue onto trail
      const currentKey = location.pathname.replace('/issue/', '');
      breadcrumbPush({ path: location.pathname, label: currentKey });
    } else {
      // From a list page — push source page name as first breadcrumb entry
      breadcrumbReset();
      breadcrumbPush({ path: location.pathname, label: routeLabel(location.pathname) });
    }

    navigate(`/issue/${issueKey}`);

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

    // 2. Search backlog cache (flat JiraIssue[] arrays from Phase 48 refactor)
    if (!resolvedTitle) {
      const sprintStoriesEntries = queryClient.getQueriesData<CachedIssue[]>({
        queryKey: ['jira-sprint-stories'],
      });
      for (const [, data] of sprintStoriesEntries) {
        if (!data) continue;
        resolvedTitle = findTitle(data);
        if (resolvedTitle) break;
      }
    }
    if (!resolvedTitle) {
      const backlogSprintStoriesEntries = queryClient.getQueriesData<CachedIssue[]>({
        queryKey: ['jira-backlog-sprint-stories'],
      });
      for (const [, data] of backlogSprintStoriesEntries) {
        if (!data) continue;
        resolvedTitle = findTitle(data);
        if (resolvedTitle) break;
      }
    }
    if (!resolvedTitle) {
      const backlogIssuesEntries = queryClient.getQueriesData<CachedIssue[]>({
        queryKey: ['jira-backlog-issues'],
      });
      for (const [, data] of backlogIssuesEntries) {
        if (!data) continue;
        resolvedTitle = findTitle(data);
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
        if (match) {
          resolvedTitle = match.summary;
          break;
        }
      }
    }

    // 4. Check jira-issue-detail cache (single issue, key includes baseUrl)
    if (!resolvedTitle) {
      const detailEntries = queryClient.getQueriesData<CachedIssue>({
        queryKey: ['jira-issue-detail', issueKey],
      });
      for (const [, data] of detailEntries) {
        if (data?.fields?.summary) {
          resolvedTitle = data.fields.summary;
          break;
        }
      }
    }

    pushRecentItem({ type: 'jira', id: issueKey, title: resolvedTitle });
  };

  const handleMRClick = (projectIdAndIid: string) => {
    breadcrumbReset();
    navigate(`/mr/${projectIdAndIid}`);
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

  const handleOpenClone = (vals: EditInitialValues) => {
    wasStoryCreate.current = false;
    setCreateModalMode('create');
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
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
    }
    wasStoryCreate.current = false;
    setCreateModalOpen(false);
  };

  // Bring window to front when OS notification click activates the app
  useEffect(() => {
    getCurrentWindow()
      .setFocus()
      .catch(() => {});
  }, []);

  // Notification polling — runs inside QueryClientProvider context
  useNotificationPolling();
  useUpdatePolling();
  useCustomFieldDiscovery();
  useSavedFilterSync();

  if (!onboardingComplete) {
    // During onboarding, no sidebar
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar
          onIssueClick={(key) => handleIssueClick(key, true)}
          onMRClick={handleMRClick}
          paletteOpen={paletteOpen}
          onPaletteOpen={() => setPaletteOpen(true)}
          notifPopoverOpen={notifPopoverOpen}
          onNotifPopoverChange={setNotifPopoverOpen}
        />
        {pinnedKeys.length > 0 && (
          <PinnedTabStrip
            pinnedKeys={pinnedKeys}
            activeKey={activeIssueKey ?? activeCycleKey}
            onTabClick={(key) => {
              if (key.includes('-CY-')) {
                const meta = pinnedCycleMeta[key];
                if (meta) navigate(`/aio-cycle/${meta.projectKey}/${key}`);
              } else {
                handleIssueClick(key, true);
              }
            }}
            onTabClose={removePin}
            onReorder={reorderPins}
            resolvedTabs={resolvedPinnedTabs}
          />
        )}
        {_hasHydrated && !jiraConnected && <ReAuthBanner />}
        {_hasHydrated && !gitlabConnected && <GitLabReAuthBanner />}
        {softMinimumActive && !softNagDismissed && policy && (
          <SoftMinimumBanner
            policy={policy}
            onDismiss={() => setSoftNagDismissed(true)}
            onUpdate={handleBannerUpdate}
          />
        )}
        <main className="flex-1 overflow-auto">
          <Outlet
            context={{
              onIssueClick: handleIssueClick,
              onEpicClick: handleIssueClick,
              openEdit: handleOpenEdit,
              openClone: handleOpenClone,
              openAddSubtask: handleOpenAddSubtask,
              openCreateStory: handleOpenCreateStory,
            }}
          />
        </main>
      </div>
      {/* Command palette overlay */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onIssueClick={(key) => {
          handleIssueClick(key, true);
          setPaletteOpen(false);
        }}
        onNavigate={handlePaletteNavigate}
        onOpenNotifications={handlePaletteOpenNotifications}
        onOpenCreate={handleOpenCreate}
      />
      <CreateEditIssueModal
        open={createModalOpen}
        onClose={handleCreateModalClose}
        mode={createModalMode}
        initialValues={createModalInitialValues}
        defaultIssueType={createModalDefaultType}
        defaultParentKey={createModalDefaultParent}
      />
      <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <UpdateDialog />
      <WhatsNewDialog />
      {hardMinimumActive && policy && <HardMinimumOverlay policy={policy} />}
    </div>
  );
}

const router = createHashRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: routes,
  },
]);

// Apply persisted theme BEFORE first render to avoid flash of wrong theme.
// loadTheme() falls back to 'system' if no preference is saved.
// applyDensity('default') sets the density baseline synchronously — no flash
// because 'default' means no data-density attribute (CSS baseline sizing).
// After hydration, AppearanceSection's useEffect will apply the stored density.
applyDensity('default');
Promise.all([loadTheme(), initAvatarCache().catch(() => {})]).then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
