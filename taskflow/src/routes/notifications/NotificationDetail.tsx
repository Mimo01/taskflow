/**
 * NotificationDetail — read-only detail panel for a notification.
 *
 * Shows source badge, entity title as heading, author + formatted timestamp,
 * and full body text in a scrollable pre block. Rendered inline below the clicked row.
 */
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

      {/* Source badge */}
      <span
        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${
          isJira
            ? 'bg-orange-100 text-orange-700'
            : 'bg-purple-100 text-purple-700'
        }`}
      >
        {isJira ? 'Jira' : 'GitLab'}
      </span>

      {/* Entity title */}
      <h3 className="text-sm font-semibold mb-1 pr-6">{item.entityTitle}</h3>

      {/* Author + timestamp */}
      <p className="text-xs text-muted-foreground mb-3">
        {item.author} · {formatTimestamp(item.createdAt)}
      </p>

      {/* Full body */}
      <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-48 bg-muted/30 p-2 rounded text-foreground">
        {item.fullBody}
      </pre>
    </div>
  );
}
