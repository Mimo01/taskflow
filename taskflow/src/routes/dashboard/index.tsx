/**
 * DashboardPage — three-tab developer dashboard shell.
 *
 * Tabs: My Tasks | Sprint Board | MR Attention
 * Active tab persisted in ephemeral Zustand store (resets on restart).
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboard.store';
import MyTasksTab from './MyTasksTab';
import SprintBoardTab from './SprintBoardTab';
import MrAttentionTab from './MrAttentionTab';

export default function Dashboard() {
  const { activeTab, setActiveTab } = useDashboardStore();

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
