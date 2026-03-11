/**
 * DashboardPage — role-conditional dashboard shell.
 *
 * PM role (role === 'pm'):
 *   Tabs: Sprint Progress | Workload | Releases
 *   Active tab persisted in pmActiveTab (ephemeral Zustand store).
 *
 * Developer role (role !== 'pm'):
 *   Tabs: My Tasks | Sprint Board | MR Attention (unchanged)
 *   Active tab persisted in activeTab (ephemeral Zustand store).
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboard.store';
import type { PmDashTab } from '@/stores/dashboard.store';
import { useSettingsStore } from '@/stores/settings.store';
import MyTasksTab from './MyTasksTab';
import SprintBoardTab from './SprintBoardTab';
import MrAttentionTab from './MrAttentionTab';
import SprintProgressTab from './SprintProgressTab';
import WorkloadTab from './WorkloadTab';
import ReleasesTab from './ReleasesTab';

export default function Dashboard() {
  const { activeTab, setActiveTab, pmActiveTab, setPmActiveTab } = useDashboardStore();
  const role = useSettingsStore((s) => s.role);

  if (role === 'pm') {
    return (
      <div className="flex flex-col h-full p-4 gap-4">
        <Tabs value={pmActiveTab} onValueChange={(v) => setPmActiveTab(v as PmDashTab)}>
          <TabsList>
            <TabsTrigger value="sprint-progress">Sprint Progress</TabsTrigger>
            <TabsTrigger value="workload">Workload</TabsTrigger>
            <TabsTrigger value="releases">Releases</TabsTrigger>
          </TabsList>

          <TabsContent value="sprint-progress">
            <SprintProgressTab />
          </TabsContent>

          <TabsContent value="workload">
            <WorkloadTab />
          </TabsContent>

          <TabsContent value="releases">
            <ReleasesTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
          <TabsTrigger value="sprint-board">Sprint Board</TabsTrigger>
          <TabsTrigger value="mr-attention">MR Attention</TabsTrigger>
        </TabsList>

        <TabsContent value="my-tasks">
          <MyTasksTab />
        </TabsContent>

        <TabsContent value="sprint-board">
          <SprintBoardTab />
        </TabsContent>

        <TabsContent value="mr-attention">
          <MrAttentionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
