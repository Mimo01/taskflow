/**
 * DevToolsSettings — Collapsible settings panel for Developer Tools.
 *
 * Master toggle + four granular toggles + retention limit dropdown.
 * Collapsed by default.
 */
import { useState } from 'react';
import { Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings.store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const RETENTION_OPTIONS = ['50', '100', '200', '500', '1000'] as const;

export default function DevToolsSettings() {
  const [open, setOpen] = useState(false);

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

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
      >
        <Settings className="size-4 text-muted-foreground" />
        <span>Settings</span>
        <span className="ml-auto">
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </span>
      </button>

      {open && (
        <div className="bg-muted rounded-b-lg p-4 flex flex-col gap-4 border-t border-border">
          {/* Master toggle */}
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary shrink-0"
              checked={devToolsEnabled}
              onChange={(e) => setDevToolsEnabled(e.target.checked)}
            />
            <div>
              <span className="font-medium">Enable Developer Tools</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Capture API requests, profile operations, and record performance data.
              </p>
            </div>
          </label>

          {/* Granular toggles */}
          <div className={!devToolsEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <div className="flex flex-col gap-3 ml-7">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary shrink-0"
                  checked={requestLogging}
                  onChange={(e) => setRequestLogging(e.target.checked)}
                />
                Request logging
              </label>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary shrink-0"
                  checked={responseBodyCapture}
                  onChange={(e) => setResponseBodyCapture(e.target.checked)}
                />
                Response body capture
              </label>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary shrink-0"
                  checked={operationProfiling}
                  onChange={(e) => setOperationProfiling(e.target.checked)}
                />
                Operation profiling
              </label>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary shrink-0"
                  checked={performanceWaterfall}
                  onChange={(e) => setPerformanceWaterfall(e.target.checked)}
                />
                Performance waterfall
              </label>

              {/* Retention dropdown */}
              <div className="flex items-center gap-3 text-sm">
                <span>Retention limit</span>
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
      )}
    </div>
  );
}
