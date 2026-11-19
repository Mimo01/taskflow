/**
 * DevToolsPage — Developer Tools page shell.
 *
 * Full-height tool under the standard PageHeader (settings gear + Clear all). Tabs carry live
 * counts; each tab owns its scrolling, so only the list and inspector panes scroll.
 */

import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useDebugLogStore } from '../../stores/debug-log.store';
import { useNotificationDispatchLogStore } from '../../stores/notification-dispatch-log.store';
import { useWikiEditorLogStore } from '../../stores/wiki-editor-log.store';
import DevToolsSettingsPopover from './DevToolsSettingsPopover';
import { useDevToolsViewStore } from './dev-tools-view.store';
import EditorTab from './EditorTab';
import LogsTab from './LogsTab';
import NotificationsTab from './NotificationsTab';

function TabLabel({ label, count }: { label: string; count: number }) {
  return (
    <>
      {label}
      <span aria-hidden="true" className="ml-1.5 tabular-nums text-muted-foreground">
        {count}
      </span>
    </>
  );
}

export default function DevToolsPage() {
  const logCount = useDebugLogStore((s) => s.entries.length);
  const notificationCount = useNotificationDispatchLogStore((s) => s.entries.length);
  const editorCount = useWikiEditorLogStore((s) => s.entries.length);

  const handleClear = () => {
    useDebugLogStore.getState().clear();
    useNotificationDispatchLogStore.getState().clear();
    useWikiEditorLogStore.getState().clear();
    useDevToolsViewStore.getState().setPausedEntries(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Developer Tools"
        actions={
          <>
            <DevToolsSettingsPopover />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={logCount === 0 && notificationCount === 0 && editorCount === 0}
            >
              Clear all
            </Button>
          </>
        }
      />

      <Tabs defaultValue="logs" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="shrink-0 px-6 pt-2 pb-1">
          <TabsList variant="line">
            <TabsTrigger value="logs">
              <TabLabel label="Logs" count={logCount} />
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <TabLabel label="Notifications" count={notificationCount} />
            </TabsTrigger>
            <TabsTrigger value="editor">
              <TabLabel label="Editor" count={editorCount} />
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="logs" className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <LogsTab />
          </div>
        </TabsContent>
        <TabsContent value="notifications" className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <NotificationsTab />
          </div>
        </TabsContent>
        <TabsContent value="editor" className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <EditorTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
