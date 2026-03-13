/**
 * NotificationDetail — read-only detail panel for a notification.
 *
 * Shows source badge, notification type label, entity title (clickable when url present),
 * author + formatted timestamp, metadata chips, Open button, and linkified full body.
 * Rendered inline below the clicked row.
 */
import { openUrl } from '@tauri-apps/plugin-opener';
import type { NotificationItem } from '../../stores/notifications.store';

interface NotificationDetailProps {
  item: NotificationItem;
  onClose: () => void;
}

function formatTimestamp(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoTimestamp));
}

function linkifyText(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-700">$1</a>',
  );
}

export default function NotificationDetail({ item, onClose }: NotificationDetailProps) {
  const isJira = item.source === 'jira';

  return (
    <div className="border rounded-md p-4 mx-2 my-1 bg-background relative">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close detail"
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 rounded"
      >
        ✕
      </button>

      {/* Source badge + type label */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
            isJira ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
          }`}
        >
          {isJira ? 'Jira' : 'GitLab'}
        </span>
        {item.notificationType && (
          <span className="inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {item.notificationType === 'comment-mention'
              ? 'Comment mention'
              : item.notificationType === 'issue-update'
                ? 'Issue update'
                : 'MR note'}
          </span>
        )}
      </div>

      {/* Entity title — clickable when url present */}
      <h3 className="text-sm font-semibold mb-1 pr-6">
        {item.url ? (
          <button
            type="button"
            onClick={() => openUrl(item.url!)}
            className="text-left hover:underline text-blue-600"
          >
            {item.entityTitle}
          </button>
        ) : (
          item.entityTitle
        )}
      </h3>

      {/* Author + timestamp */}
      <p className="text-xs text-muted-foreground mb-2">
        {item.author} · {formatTimestamp(item.createdAt)}
      </p>

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-1 mb-2">
        {item.priority && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
            {item.priority}
          </span>
        )}
        {item.labels?.map((label) => (
          <span
            key={label}
            className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border"
          >
            {label}
          </span>
        ))}
        {item.entityState && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded border ${
              item.entityState === 'merged'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : item.entityState === 'closed'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-green-50 text-green-700 border-green-200'
            }`}
          >
            {item.entityState}
          </span>
        )}
      </div>

      {/* Open button */}
      {item.url && (
        <button
          type="button"
          onClick={() => openUrl(item.url!)}
          className="mt-2 mb-2 text-xs px-3 py-1 rounded border hover:bg-muted transition-colors"
        >
          Open in {item.source === 'jira' ? 'Jira' : 'GitLab'} ↗
        </button>
      )}

      {/* Full body — linkified */}
      <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-48 bg-muted/30 p-2 rounded text-foreground">
        <span dangerouslySetInnerHTML={{ __html: linkifyText(item.fullBody) }} />
      </pre>
    </div>
  );
}
