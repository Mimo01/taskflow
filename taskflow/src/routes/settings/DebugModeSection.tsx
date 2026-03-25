/**
 * DebugModeSection — Advanced settings for Developer Tools.
 *
 * Master toggle + granular toggles + retention limit + clear notifications.
 * Rendered inside Settings → Advanced.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotificationsStore } from '../../stores/notifications.store';
import { useSettingsStore } from '../../stores/settings.store';

const RETENTION_OPTIONS = ['50', '100', '200', '500', '1000'] as const;

export default function DebugModeSection() {
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const setDevToolsEnabled = useSettingsStore((s) => s.setDevToolsEnabled);
  const requestLogging = useSettingsStore((s) => s.requestLogging);
  const setRequestLogging = useSettingsStore((s) => s.setRequestLogging);
  const responseBodyCapture = useSettingsStore((s) => s.responseBodyCapture);
  const setResponseBodyCapture = useSettingsStore((s) => s.setResponseBodyCapture);
  const operationProfiling = useSettingsStore((s) => s.operationProfiling);
  const setOperationProfiling = useSettingsStore((s) => s.setOperationProfiling);
  const performanceWaterfall = useSettingsStore((s) => s.performanceWaterfall);
  const setPerformanceWaterfall = useSettingsStore((s) => s.setPerformanceWaterfall);
  const retentionLimit = useSettingsStore((s) => s.retentionLimit);
  const setRetentionLimit = useSettingsStore((s) => s.setRetentionLimit);
  const clearAll = useNotificationsStore((s) => s.clearAll);
  const itemCount = useNotificationsStore((s) => s.items.length);
  const [cleared, setCleared] = useState(false);

  function handleClear() {
    clearAll();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Advanced</h2>

      {/* Developer Tools section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Developer Tools
        </h3>

        {/* Master toggle */}
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium">Enable Developer Tools</p>
            <p className="text-xs text-muted-foreground">
              Capture API requests, profile operations, and record performance data.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Enable Developer Tools"
            checked={devToolsEnabled}
            onChange={(e) => setDevToolsEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary shrink-0"
          />
        </label>

        {/* Granular toggles */}
        <div className={!devToolsEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <div className="flex flex-col gap-3 ml-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <p className="text-sm font-medium">Request logging</p>
              <input
                type="checkbox"
                aria-label="Request logging"
                checked={requestLogging}
                onChange={(e) => setRequestLogging(e.target.checked)}
                className="h-4 w-4 accent-primary shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <p className="text-sm font-medium">Response body capture</p>
              <input
                type="checkbox"
                aria-label="Response body capture"
                checked={responseBodyCapture}
                onChange={(e) => setResponseBodyCapture(e.target.checked)}
                className="h-4 w-4 accent-primary shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <p className="text-sm font-medium">Operation profiling</p>
              <input
                type="checkbox"
                aria-label="Operation profiling"
                checked={operationProfiling}
                onChange={(e) => setOperationProfiling(e.target.checked)}
                className="h-4 w-4 accent-primary shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <p className="text-sm font-medium">Performance waterfall</p>
              <input
                type="checkbox"
                aria-label="Performance waterfall"
                checked={performanceWaterfall}
                onChange={(e) => setPerformanceWaterfall(e.target.checked)}
                className="h-4 w-4 accent-primary shrink-0"
              />
            </label>

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Retention limit</p>
              <Select
                value={retentionLimit.toString()}
                onValueChange={(val) => setRetentionLimit(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Clear notifications */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Data
        </h3>
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
                    resets the polling cursor. The next poll cycle will re-fetch the last 24 hours
                    of activity.
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
    </div>
  );
}
