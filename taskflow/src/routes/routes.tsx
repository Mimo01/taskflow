import { type ComponentType, lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ChunkErrorBoundary } from '../components/ChunkErrorBoundary';
import { RouteSpinner } from '../components/ui/route-spinner';
import Dashboard from './dashboard/index';
import MyTasksTab from './dashboard/MyTasksTab';
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
const ReleaseDetailPage = lazy(() => import('./dashboard/ReleaseDetailPage'));
const MergeRequestListPage = lazy(() => import('./dashboard/MergeRequestListPage'));
const MergeRequestDetailPage = lazy(() => import('./dashboard/MergeRequestDetailPage'));
const AioProjectOverviewPage = lazy(() => import('./dashboard/AioProjectOverviewPage'));
const AioCycleDetailPage = lazy(() => import('./dashboard/AioCycleDetailPage'));
const AioTestRunDetailPage = lazy(() => import('./dashboard/AioTestRunDetailPage'));

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
  { path: '/sprint-progress', element: withLazy(SprintProgressTab) },
  { path: '/workload', element: withLazy(WorkloadTab) },
  { path: '/releases', element: <ReleasesTab /> },
  { path: '/release/:versionId', element: withLazy(ReleaseDetailPage) },
  { path: '/dev-tools', element: <DevTools /> },
  { path: '/issue/:key', element: withLazy(IssueDetailPage) },
  { path: '/merge-requests', element: withLazy(MergeRequestListPage) },
  { path: '/mr/:projectId/:iid', element: withLazy(MergeRequestDetailPage) },
  { path: '/aio-project/:projectKey', element: withLazy(AioProjectOverviewPage) },
  { path: '/aio-cycle/:projectKey/:cycleKey', element: withLazy(AioCycleDetailPage) },
  {
    path: '/aio-cycle/:projectKey/:cycleKey/run/:runId',
    element: withLazy(AioTestRunDetailPage),
  },
];
