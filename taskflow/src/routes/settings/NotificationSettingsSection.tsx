/**
 * NotificationSettingsSection — Settings section for notification preferences.
 *
 * Controls:
 * - Poll interval (seconds) — clamped [30, 300] by setter in settings store
 * - Per-type notification toggles grouped by source (Jira / GitLab)
 * - In-app banner duration (Off / 3s / 5s / 8s)
 * - OS desktop notification toggle
 *
 * Follows the same layout pattern as StaleMrThresholdSection.
 */

import { Alert, AlertDescription } from '../../components/ui/alert';
import { cn } from '../../lib/utils';
import { useNotificationsStore } from '../../stores/notifications.store';
import { useSettingsStore } from '../../stores/settings.store';

const BANNER_DURATIONS = [
  { value: 0, label: 'Off' },
  { value: 3, label: '3s' },
  { value: 5, label: '5s' },
  { value: 8, label: '8s' },
] as const;

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </label>
      </div>
      {description && <p className="text-xs text-muted-foreground pl-7">{description}</p>}
    </div>
  );
}

export default function NotificationSettingsSection() {
  const { notificationSendError } = useNotificationsStore();

  const {
    notificationPollIntervalSecs,
    desktopNotificationsEnabled,
    notifCommentMentionEnabled,
    notifIssueUpdateEnabled,
    notifMrNoteEnabled,
    notifGitlabMentionEnabled,
    notifJiraCommentEnabled,
    notifMrApprovalEnabled,
    notifPipelineFailureEnabled,
    notifIssueAssignmentEnabled,
    notifDueDateReminderEnabled,
    notifBannerDurationSecs,
    setNotifBannerDurationSecs,
    setNotificationPollIntervalSecs,
    setDesktopNotificationsEnabled,
    setNotifCommentMentionEnabled,
    setNotifIssueUpdateEnabled,
    setNotifMrNoteEnabled,
    setNotifGitlabMentionEnabled,
    setNotifJiraCommentEnabled,
    setNotifMrApprovalEnabled,
    setNotifPipelineFailureEnabled,
    setNotifIssueAssignmentEnabled,
    setNotifDueDateReminderEnabled,
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

      {/* Jira Notifications */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Jira Notifications
        </h4>
        <ToggleRow
          id="notif-comment-mention"
          label="Comment mentions"
          description="When you're @mentioned in a comment"
          checked={notifCommentMentionEnabled}
          onChange={setNotifCommentMentionEnabled}
        />
        <ToggleRow
          id="notif-jira-comment"
          label="All comments"
          description="On issues you're involved in (assignee, reporter, watcher)"
          checked={notifJiraCommentEnabled}
          onChange={setNotifJiraCommentEnabled}
        />
        <ToggleRow
          id="notif-issue-update"
          label="Issue updates"
          description="Status and assignee changes"
          checked={notifIssueUpdateEnabled}
          onChange={setNotifIssueUpdateEnabled}
        />
        <ToggleRow
          id="notif-issue-assignment"
          label="Issue assignments"
          description="When an issue is assigned to you"
          checked={notifIssueAssignmentEnabled}
          onChange={setNotifIssueAssignmentEnabled}
        />
        <ToggleRow
          id="notif-due-date"
          label="Due date reminders"
          description="Issues due within 1 day"
          checked={notifDueDateReminderEnabled}
          onChange={setNotifDueDateReminderEnabled}
        />
      </div>

      {/* GitLab Notifications */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          GitLab Notifications
        </h4>
        <ToggleRow
          id="notif-mr-note"
          label="MR notes"
          description="Comments on your merge requests"
          checked={notifMrNoteEnabled}
          onChange={setNotifMrNoteEnabled}
        />
        <ToggleRow
          id="notif-gitlab-mention"
          label="@Mentions"
          description="When mentioned in MR comments"
          checked={notifGitlabMentionEnabled}
          onChange={setNotifGitlabMentionEnabled}
        />
        <ToggleRow
          id="notif-mr-approval"
          label="MR approvals"
          description="Approval or changes requested on your MRs"
          checked={notifMrApprovalEnabled}
          onChange={setNotifMrApprovalEnabled}
        />
        <ToggleRow
          id="notif-pipeline-failure"
          label="Pipeline failures"
          description="CI failures on your merge requests"
          checked={notifPipelineFailureEnabled}
          onChange={setNotifPipelineFailureEnabled}
        />
      </div>

      {/* In-app banners */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          In-app banners
        </h4>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span id="banner-duration-label" className="text-sm font-medium">
              Banner duration
            </span>
            <p className="text-xs text-muted-foreground">How long in-app banners stay on screen</p>
          </div>
          <fieldset
            aria-labelledby="banner-duration-label"
            className="m-0 inline-flex flex-none rounded-lg border-0 bg-muted p-0.5"
          >
            {BANNER_DURATIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={notifBannerDurationSecs === value}
                onClick={() => setNotifBannerDurationSecs(value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  notifBannerDurationSecs === value
                    ? 'bg-background text-foreground ring-1 ring-foreground/10'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>
      </div>

      {/* Desktop Notifications */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Desktop Notifications
        </h4>
        {(notificationSendError ||
          (import.meta.env.DEV &&
            navigator.platform.startsWith('Mac') &&
            desktopNotificationsEnabled)) && (
          <Alert>
            <AlertDescription>
              {notificationSendError
                ? 'Desktop notifications failed to send. On macOS, this is expected in dev mode — a signed app bundle is required. Try a production build to verify.'
                : 'Desktop notifications may not work in dev mode on macOS — a signed app bundle is required. Try a production build to verify.'}
            </AlertDescription>
          </Alert>
        )}
        <ToggleRow
          id="desktop-os-notif"
          label="Desktop notifications"
          description="Pushes notifications as macOS system notifications as well. Requires OS notification permission."
          checked={desktopNotificationsEnabled}
          onChange={setDesktopNotificationsEnabled}
        />
      </div>
    </div>
  );
}
