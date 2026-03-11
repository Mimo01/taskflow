/**
 * NotificationSettingsSection — Settings section for notification preferences.
 *
 * Controls:
 * - Poll interval (seconds) — clamped [30, 300] by setter in settings store
 * - Jira OS notification toggle
 * - GitLab OS notification toggle
 *
 * Follows the same layout pattern as StaleMrThresholdSection.
 */
import { useSettingsStore } from '../../stores/settings.store';

export default function NotificationSettingsSection() {
  const {
    notificationPollIntervalSecs,
    osNotifJiraEnabled,
    osNotifGitlabEnabled,
    setNotificationPollIntervalSecs,
    setOsNotifJiraEnabled,
    setOsNotifGitlabEnabled,
  } = useSettingsStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Configure notification polling and desktop notification preferences.
        </p>
      </div>

      {/* Poll interval */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="poll-interval" className="text-sm font-medium">
          Poll interval (seconds)
        </label>
        <input
          id="poll-interval"
          type="number"
          min={30}
          max={300}
          step={10}
          value={notificationPollIntervalSecs}
          onChange={(e) => setNotificationPollIntervalSecs(Number(e.target.value))}
          className="w-32 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">Minimum 30 seconds, maximum 300 seconds.</p>
      </div>

      {/* Jira OS notifications toggle */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <input
            id="jira-os-notif"
            type="checkbox"
            checked={osNotifJiraEnabled}
            onChange={(e) => setOsNotifJiraEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <label htmlFor="jira-os-notif" className="text-sm font-medium cursor-pointer">
            Jira desktop notifications
          </label>
        </div>
        <p className="text-xs text-muted-foreground pl-7">
          Requires OS notification permission to be granted
        </p>
      </div>

      {/* GitLab OS notifications toggle */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <input
            id="gitlab-os-notif"
            type="checkbox"
            checked={osNotifGitlabEnabled}
            onChange={(e) => setOsNotifGitlabEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <label htmlFor="gitlab-os-notif" className="text-sm font-medium cursor-pointer">
            GitLab desktop notifications
          </label>
        </div>
        <p className="text-xs text-muted-foreground pl-7">
          Requires OS notification permission to be granted
        </p>
      </div>
    </div>
  );
}
