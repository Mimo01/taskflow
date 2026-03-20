/**
 * DevToolsPage — Developer Tools page shell.
 *
 * Provides header with Clear Logs button, collapsible settings panel,
 * and three tabs: Logs, Operations, Waterfall.
 */
import { useDebugLogStore } from '../../stores/debug-log.store';
import { useOperationProfilerStore } from '../../stores/operation-profiler.store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import LogsTab from './LogsTab';
import OperationsTab from './OperationsTab';
import WaterfallTab from './WaterfallTab';

export default function DevToolsPage() {
  const entries = useDebugLogStore((s) => s.entries);
  const operations = useOperationProfilerStore((s) => s.operations);
  const ungrouped = useOperationProfilerStore((s) => s.ungrouped);

  const handleClear = () => {
    useDebugLogStore.getState().clear();
    useOperationProfilerStore.getState().clear();
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Developer Tools</h1>
          <p className="text-sm text-muted-foreground mt-1">
            API debugging, operation profiling, and performance analysis.
          </p>
        </div>
        <button
          onClick={handleClear}
          disabled={entries.length === 0 && operations.length === 0 && ungrouped.length === 0}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear Logs
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
        </TabsList>
        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
        <TabsContent value="operations">
          <OperationsTab />
        </TabsContent>
        <TabsContent value="waterfall">
          <WaterfallTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
