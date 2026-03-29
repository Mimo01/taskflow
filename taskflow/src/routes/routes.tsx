import { lazy, Suspense, type ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ChunkErrorBoundary } from '../components/ChunkErrorBoundary';
import { RouteSpinner } from '../components/ui/route-spinner';
import Dashboard from './dashboard/index';
import MergeRequestDetailPage from './dashboard/MergeRequestDetailPage';
import MergeRequestListPage from './dashboard/MergeRequestListPage';
import MrAttentionTab from './dashboard/MrAttentionTab';
import MyTasksTab from './dashboard/MyTasksTab';
import ReleaseDetailPage from './dashboard/ReleaseDetailPage';
import ReleasesTab from './dashboard/ReleasesTab';
import DevTools from './dev-tools/index';
import Onboarding from './onboarding/index';
import Settings from './settings/index';

const SprintBoardTab = lazy(() => import('./dashboard/SprintBoardTab'));
const BacklogPage = lazy(() => import('./dashboard/BacklogPage'));
const IssueDetailPage = lazy(() => import('./dashboard/IssueDetailPage'));
const EpicsPage = lazy(() => import('./dashboard/EpicsPage'));
const WorkloadTab = lazy(() => import('./dashboard/WorkloadTab'));
const SprintProgressTab = lazy(() => import('./dashboard/SprintProgressTab'));

function withLazy(Component: ComponentType) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteSpinner />}>
        <Component />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Onboarding /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/settings', element: <Settings /> },
  { path: '/my-tasks', element: <MyTasksTab /> },
  { path: '/sprint-board', element: withLazy(SprintBoardTab) },
  { path: '/backlog', element: withLazy(BacklogPage) },
  { path: '/epics', element: withLazy(EpicsPage) },
  { path: '/mr-attention', element: <MrAttentionTab /> },
  { path: '/sprint-progress', element: withLazy(SprintProgressTab) },
  { path: '/workload', element: withLazy(WorkloadTab) },
  { path: '/releases', element: <ReleasesTab /> },
  { path: '/release/:versionId', element: <ReleaseDetailPage /> },
  { path: '/dev-tools', element: <DevTools /> },
  { path: '/issue/:key', element: withLazy(IssueDetailPage) },
  { path: '/merge-requests', element: <MergeRequestListPage /> },
  { path: '/mr/:projectId/:iid', element: <MergeRequestDetailPage /> },
];
