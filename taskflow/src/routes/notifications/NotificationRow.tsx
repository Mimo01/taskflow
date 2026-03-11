/**
 * NotificationRow — single notification row in the feed.
 *
 * Shows source-specific left border (orange=Jira, purple=GitLab),
 * source icon, entity title (bold when unread), body preview, and relative timestamp.
 */
import type { NotificationItem } from '../../stores/notifications.store';

interface NotificationRowProps {
  item: NotificationItem;
  isUnread?: boolean;
  onClick: () => void;
}

function getRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffSecs = Math.floor((now - then) / 1000);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationRow({ item, isUnread = false, onClick }: NotificationRowProps) {
  const borderClass = item.source === 'jira' ? 'border-orange-500' : 'border-purple-500';
  const bgClass = isUnread ? 'bg-muted/50' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left border-l-4 ${borderClass} ${bgClass} px-3 py-2 hover:bg-muted/70 transition-colors flex gap-3 items-start`}
    >
      {/* Source icon */}
      <div className="flex-shrink-0 mt-0.5">
        {item.source === 'jira' ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
            J
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
            GL
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isUnread ? 'font-bold' : 'font-normal'}`}>
          {item.entityTitle}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">{item.bodyPreview}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{getRelativeTime(item.createdAt)}</p>
      </div>
    </button>
  );
}
