import './index.css';
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { loadTheme } from './services/theme';
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
      queryClient.invalidateQueries({ queryKey: ['jira-backlog'] });
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
        <TopBar onIssueClick={setSelectedIssueKey} />
        {_hasHydrated && !jiraConnected && <ReAuthBanner />}
        {_hasHydrated && !gitlabConnected && <GitLabReAuthBanner />}
        <main className="flex-1 overflow-auto">
          <Outlet context={{ onIssueClick: setSelectedIssueKey, openEdit: handleOpenEdit, openAddSubtask: handleOpenAddSubtask, openCreateStory: handleOpenCreateStory }} />
        </main>
      </div>
      {/* Global IssueDetailSheet — accessible from search, notifications, and all route views */}
      <IssueDetailSheet
        issueKey={selectedIssueKey}
        onClose={() => setSelectedIssueKey(null)}
        onOpenIssue={setSelectedIssueKey}
        onEdit={handleOpenEdit}
        onAddSubtask={handleOpenAddSubtask}
      />
      <CreateEditIssueModal
        open={createModalOpen}
        onClose={handleCreateModalClose}
        mode={createModalMode}
        initialValues={createModalInitialValues}
        defaultIssueType={createModalDefaultType}
        defaultParentKey={createModalDefaultParent}
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
loadTheme().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
