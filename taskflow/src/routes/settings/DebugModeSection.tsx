/**
 * DebugModeSection — Settings section for API call logging.
 *
 * When enabled, every Jira and GitLab API call is captured with full
 * request/response detail. View logs at /debug-logs.
 * Logs are in-memory only — cleared on app restart.
 */
import { useSettingsStore } from '../../stores/settings.store';

export default function DebugModeSection() {
  const { debugMode, setDebugMode } = useSettingsStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Debug</h3>
        <p className="text-sm text-muted-foreground">
          Capture API call logs for troubleshooting. Logs are in-memory and cleared on restart.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <input
            id="debug-mode"
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <label htmlFor="debug-mode" className="text-sm font-medium cursor-pointer">
            Enable API call logging
          </label>
        </div>
        <p className="text-xs text-muted-foreground pl-7">
          View captured logs on the Debug Logs page in the sidebar.
        </p>
      </div>
    </div>
  );
}
