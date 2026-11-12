/**
 * NotificationsTab — OS desktop notification attempts for Developer Tools.
 *
 * One row per notification the poller tried to show (or skipped as already known),
 * with the exact title/body handed to the OS and the result. Expand for a banner-style
 * preview and the raw item.
 */
import { useState } from 'react';
import AppIcon from '../../components/app/AppIcon';
import type { OsDispatchOutcome } from '../../lib/notification-dispatch-log';
import {
  type NotificationDispatchLogEntry,
  useNotificationDispatchLogStore,
} from '../../stores/notification-dispatch-log.store';
import { useSettingsStore } from '../../stores/settings.store';
import { sourceBadgeClass } from './utils';

const OUTCOME_LABEL: Record<OsDispatchOutcome, string> = {
  sent: 'Sent',
  denied: 'Denied',
  error: 'Error',
  skipped: 'Skipped',
};

function outcomeClass(outcome: OsDispatchOutcome): string {
  const base = 'shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold';
  if (outcome === 'sent') return `${base} text-green-600 dark:text-green-400`;
  if (outcome === 'skipped') return `${base} bg-muted text-muted-foreground`;
  return `${base} bg-red-500/15 text-red-600 dark:text-red-400`;
}

/**
 * Approximation of a macOS notification banner: app icon, bold one-line title, body clamped
 * to two lines — roughly what the OS shows before the user expands it.
 */
function OsNotificationPreview({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="img"
      aria-label={`Notification preview: ${title}. ${body}`}
      className="w-[23rem] max-w-full flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-md"
    >
      <AppIcon className="size-9 shrink-0 -m-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-[13px] font-semibold leading-snug truncate flex-1 min-w-0">{title}</p>
          <span className="shrink-0 text-[11px] text-muted-foreground">now</span>
        </div>
        <p className="text-[13px] leading-snug line-clamp-2 break-words">{body}</p>
      </div>
    </div>
  );
}

function NotificationCard({ entry }: { entry: NotificationDispatchLogEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 density-compact:py-1.5 density-comfortable:py-4 text-left hover:bg-accent transition-colors text-sm"
      >
        <span className={outcomeClass(entry.outcome)}>{OUTCOME_LABEL[entry.outcome]}</span>
        <span className={sourceBadgeClass(entry.item.source)}>{entry.item.source}</span>
        <span className="font-medium truncate min-w-0 flex-[0_1_auto]">{entry.title}</span>
        <span className="text-xs truncate flex-1 min-w-0 text-muted-foreground">{entry.body}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 density-compact:py-1.5 density-comfortable:py-4 flex flex-col gap-3">
          {entry.outcome === 'skipped' && (
            <p className="text-sm text-muted-foreground">
              Not sent: this notification was already in the list before this poll.
            </p>
          )}
          <OsNotificationPreview title={entry.title} body={entry.body} />
          <details>
            <summary className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none">
              Raw item
            </summary>
            <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">
              {JSON.stringify(entry.item, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default function NotificationsTab() {
  const entries = useNotificationDispatchLogStore((s) => s.entries);
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);

  if (!devToolsEnabled) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Developer Tools are disabled. Toggle the master switch in Settings to start capturing data.
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm font-medium">No desktop notifications yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          {desktopNotificationsEnabled
            ? 'Entries appear here when a poll brings in a new notification.'
            : 'Turn on Desktop Notifications in Settings to capture them here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <NotificationCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
