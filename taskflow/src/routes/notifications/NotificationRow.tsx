/**
 * NotificationRow — single notification row in the feed.
 *
 * Shows source-specific left border (orange=Jira, purple=GitLab),
 * source icon, type label badge, entity title (bold when unread, clickable when url present),
 * metadata chips, linkified body preview, and relative timestamp.
 */
import { openUrl } from '@tauri-apps/plugin-opener';
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

function linkifyText(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-700">$1</a>',
  );
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
        {/* Type label badge */}
        {item.notificationType && (
          <span className="inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground mb-0.5">
            {item.notificationType === 'comment-mention'
              ? 'Comment mention'
              : item.notificationType === 'issue-update'
                ? 'Issue update'
                : 'MR note'}
          </span>
        )}

        {/* Entity title — clickable when url present */}
        <p className={`text-sm truncate ${isUnread ? 'font-bold' : 'font-normal'}`}>
          {item.url ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                openUrl(item.url!);
              }}
              className="hover:underline text-blue-600 cursor-pointer"
            >
              {item.entityTitle}
            </span>
          ) : (
            item.entityTitle
          )}
        </p>

        {/* Body preview — linkified */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          <span dangerouslySetInnerHTML={{ __html: linkifyText(item.bodyPreview) }} />
        </p>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-1 mt-0.5">
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

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-0.5">{getRelativeTime(item.createdAt)}</p>
      </div>
    </button>
  );
}
