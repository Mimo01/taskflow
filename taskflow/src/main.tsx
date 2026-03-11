import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loadTheme } from './services/theme';
import Onboarding from './routes/onboarding/index';
import Dashboard from './routes/dashboard/index';
import Settings from './routes/settings/index';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

const router = createHashRouter([
  { path: '/', element: <Onboarding /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/settings', element: <Settings /> },
]);

// Apply theme before first render to avoid flash of wrong theme.
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
