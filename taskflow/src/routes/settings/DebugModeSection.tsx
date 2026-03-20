/**
 * DebugModeSection — Settings section for API call logging and debug actions.
 *
 * When enabled, every Jira and GitLab API call is captured with full
 * request/response detail. View logs at /dev-tools.
 * Logs are in-memory only — cleared on app restart.
 */

import { Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useNotificationsStore } from '../../stores/notifications.store';
import { useSettingsStore } from '../../stores/settings.store';

export default function DebugModeSection() {
  const { devToolsEnabled, setDevToolsEnabled } = useSettingsStore();
  const clearAll = useNotificationsStore((s) => s.clearAll);
  const itemCount = useNotificationsStore((s) => s.items.length);
  const [cleared, setCleared] = useState(false);

  function handleClear() {
    clearAll();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Diagnostics
        </h3>
      </div>

      {/* API logging toggle — same layout as WorkflowSection toggles */}
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="text-sm font-medium">API call logging</p>
          <p className="text-xs text-muted-foreground">
            Capture every Jira and GitLab request with full detail. View on the Developer Tools page.
          </p>
        </div>
        <input
          type="checkbox"
          aria-label="Enable API call logging"
          checked={devToolsEnabled}
          onChange={(e) => setDevToolsEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary shrink-0"
        />
      </label>

      {/* Clear notifications — same row layout, button instead of checkbox */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Clear notification cache</p>
          <p className="text-xs text-muted-foreground">
            {cleared
              ? 'Done — next poll will re-fetch the last 24 hours'
              : `${itemCount} notification${itemCount !== 1 ? 's' : ''} cached. Clears all and resets the polling cursor.`}
          </p>
        </div>
        {cleared ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
            <Check className="h-3.5 w-3.5" />
            Cleared
          </div>
        ) : (
          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={itemCount === 0}
                  className="shrink-0"
                />
              }
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Clear all notifications?</DialogTitle>
                <DialogDescription>
                  This removes all {itemCount} cached notification{itemCount !== 1 ? 's' : ''} and
                  resets the polling cursor. The next poll cycle will re-fetch the last 24 hours of
                  activity.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <DialogClose render={<Button variant="destructive" onClick={handleClear} />}>
                  Clear all
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
