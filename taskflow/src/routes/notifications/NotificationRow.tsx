/**
 * NotificationRow — single notification row in the feed.
 *
 * Shows source-specific left border (orange=Jira, purple=GitLab),
 * source icon, type label badge, entity title (bold when unread, clickable when url present),
 * metadata chips, linkified body preview, and relative timestamp.
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

function getInitials(name: string): string {
  if (!name || name === 'Unknown') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function linkifyText(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-700">$1</a>',
  );
}

export default function NotificationRow({ item, isUnread = false, onClick }: NotificationRowProps) {
  const borderClass = item.source === 'jira' ? 'border-orange-500' : 'border-purple-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left border-l-4 ${borderClass} px-3 py-2 transition-all flex gap-3 items-start ${isUnread ? 'bg-accent/50 hover:bg-accent' : 'hover:bg-muted'}`}
    >
      {/* Unread dot + avatar */}
      <div className="flex-shrink-0 mt-0.5 relative">
        {isUnread && (
          <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-blue-500 z-10" />
        )}
        {item.authorAvatarUrl ? (
          <img
            src={item.authorAvatarUrl}
            alt={item.author}
            className="w-6 h-6 rounded-full object-cover"
            onError={(e) => {
              const img = e.currentTarget;
              img.style.display = 'none';
              const sibling = img.nextElementSibling as HTMLElement | null;
              if (sibling) sibling.style.display = 'flex';
            }}
          />
        ) : null}
        <span
          className={`items-center justify-center w-6 h-6 rounded-full text-[10px] font-medium ${
            item.source === 'jira'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-purple-100 text-purple-700'
          }`}
          style={{ display: item.authorAvatarUrl ? 'none' : 'flex' }}
        >
          {getInitials(item.author)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Type label badge */}
        {item.notificationType && (() => {
          const labelMap: Record<string, string> = {
            'comment-mention': 'Mentioned',
            'issue-update': 'Issue update',
            'mr-note': 'MR comment',
            'gitlab-mention': 'Mentioned',
            'jira-comment': 'Comment',
            'mr-approval': 'Approval',
            'pipeline-failure': 'Pipeline failed',
            'issue-assignment': 'Assigned',
            'due-date-reminder': 'Due soon',
          };
          const colorMap: Record<string, string> = {
            'pipeline-failure': 'bg-red-100 text-red-700',
            'mr-approval': 'bg-green-100 text-green-700',
            'due-date-reminder': 'bg-amber-100 text-amber-700',
            'issue-assignment': 'bg-blue-100 text-blue-700',
            'issue-update': 'bg-teal-100 text-teal-700',
            'jira-comment': 'bg-violet-100 text-violet-700',
          };
          const label = labelMap[item.notificationType] ?? item.notificationType;
          const color = colorMap[item.notificationType] ?? 'bg-muted text-muted-foreground';
          return (
            <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${color} mb-0.5`}>
              {label}
            </span>
          );
        })()}

        {/* Parent story context for subtasks */}
        {item.parentKey && (
          <p className="text-xs text-muted-foreground truncate">
            <span className="font-medium">{item.parentKey}</span>
            {item.parentSummary && <span>: {item.parentSummary}</span>}
          </p>
        )}

        {/* Entity title */}
        <p className={`text-sm truncate ${isUnread ? 'font-bold' : 'font-normal'}`}>
          {item.entityTitle}
        </p>

        {/* Body preview — styled change lines for arrow-format, linkified for plain text */}
        {(item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
         item.bodyPreview.includes('\u2192')
          ? (
            <div className="flex flex-col gap-0.5 mt-0.5">
              {(item.bodyPreview.includes(' | ') ? item.bodyPreview.split(' | ') : [item.bodyPreview]).map((line, i) => {
                const colonIdx = line.indexOf(':');
                const field = colonIdx > 0 ? line.slice(0, colonIdx).trim() : null;
                const rest = colonIdx > 0 ? line.slice(colonIdx + 1).trim() : line;
                const arrowIdx = rest.indexOf('\u2192');
                const from = arrowIdx >= 0 ? rest.slice(0, arrowIdx).trim() : null;
                const to = arrowIdx >= 0 ? rest.slice(arrowIdx + 1).trim() : rest;

                return (
                  <span key={i} className="flex items-center gap-1 text-xs">
                    {field && <span className="font-semibold text-muted-foreground">{field}:</span>}
                    {from !== null ? (
                      <>
                        <span className="text-muted-foreground">{from || '(none)'}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className={`font-medium ${isUnread ? 'text-foreground' : 'text-foreground/70'}`}>{to || '(none)'}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{to}</span>
                    )}
                  </span>
                );
              })}
            </div>
          )
          : (
            <p className={`text-xs line-clamp-2 ${isUnread ? 'text-foreground/70' : 'text-muted-foreground'}`}>
              <span dangerouslySetInnerHTML={{ __html: linkifyText(item.bodyPreview) }} />
            </p>
          )
        }

        {/* Metadata chips */}
        {item.entityState && (
          <div className="flex flex-wrap gap-1 mt-0.5">
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
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-0.5">{getRelativeTime(item.createdAt)}</p>
      </div>
    </button>
  );
}
