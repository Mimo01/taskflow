import type { RouteObject } from 'react-router-dom';
import BacklogPage from './dashboard/BacklogPage';
import EpicsPage from './dashboard/EpicsPage';
import IssueDetailPage from './dashboard/IssueDetailPage';
import Dashboard from './dashboard/index';
import MergeRequestDetailPage from './dashboard/MergeRequestDetailPage';
import MergeRequestListPage from './dashboard/MergeRequestListPage';
import MrAttentionTab from './dashboard/MrAttentionTab';
import MyTasksTab from './dashboard/MyTasksTab';
import ReleasesTab from './dashboard/ReleasesTab';
import SprintBoardTab from './dashboard/SprintBoardTab';
import SprintProgressTab from './dashboard/SprintProgressTab';
import WorkloadTab from './dashboard/WorkloadTab';
import DebugLogs from './debug-logs/index';
import Onboarding from './onboarding/index';
import Settings from './settings/index';

export const routes: RouteObject[] = [
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
  { path: '/issue/:key', element: <IssueDetailPage /> },
  { path: '/merge-requests', element: <MergeRequestListPage /> },
  { path: '/mr/:projectId/:iid', element: <MergeRequestDetailPage /> },
];
