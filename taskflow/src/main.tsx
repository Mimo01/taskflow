import './index.css';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { loadTheme } from './services/theme';
import { useSettingsStore } from './stores/settings.store';
import { useAuthStore } from './stores/auth.store';
import Sidebar from './components/app/Sidebar';
import ReAuthBanner from './components/app/ReAuthBanner';
import TopBar from './components/app/TopBar';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import { readSecret } from './services/stronghold';
import { discoverStoryPointsField } from './services/jira';
import Onboarding from './routes/onboarding/index';
import Dashboard from './routes/dashboard/index';
import Settings from './routes/settings/index';
import MyTasksTab from './routes/dashboard/MyTasksTab';
import SprintBoardTab from './routes/dashboard/SprintBoardTab';
import MrAttentionTab from './routes/dashboard/MrAttentionTab';
import SprintProgressTab from './routes/dashboard/SprintProgressTab';
import WorkloadTab from './routes/dashboard/WorkloadTab';
import ReleasesTab from './routes/dashboard/ReleasesTab';
import DebugLogs from './routes/debug-logs/index';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Runs discoverStoryPointsField once when Jira credentials first become available.
 * Caches the result in settingsStore.storyPointsFieldKey for use by all sprint queries.
 * staleTime: Infinity — field keys do not change without a Jira admin action.
 */
function useStoryPointsFieldDiscovery() {
  const { jiraConnected, jiraBaseUrl } = useAuthStore();
  const { setStoryPointsFieldKey } = useSettingsStore();

  const query = useQuery({
    queryKey: ['jira-story-points-field', jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return 'customfield_10016';
      return discoverStoryPointsField(jiraBaseUrl, token);
    },
    staleTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraConnected,
  });

  useEffect(() => {
    if (query.data) {
      setStoryPointsFieldKey(query.data);
    }
  }, [query.data, setStoryPointsFieldKey]);
}

/**
 * AppLayout — renders Sidebar + main content when user has completed onboarding.
 * Shows ReAuthBanner if jiraConnected is false but onboarding is complete.
 */
function AppLayout() {
  const { onboardingComplete } = useSettingsStore();
  const { jiraConnected } = useAuthStore();

  // Bring window to front when OS notification click activates the app
  useEffect(() => {
    getCurrentWindow().setFocus().catch(() => {});
  }, []);

  // Notification polling — runs inside QueryClientProvider context
  useNotificationPolling();
  useStoryPointsFieldDiscovery();

  if (!onboardingComplete) {
    // During onboarding, no sidebar
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        {!jiraConnected && <ReAuthBanner />}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Onboarding /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/settings', element: <Settings /> },
      { path: '/my-tasks', element: <MyTasksTab /> },
      { path: '/sprint-board', element: <SprintBoardTab /> },
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
