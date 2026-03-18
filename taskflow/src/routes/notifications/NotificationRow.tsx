/**
 * NotificationRow — single notification row in the feed.
 *
 * Click = toggle read/unread (stay in popover).
 * Hover actions appear where the timestamp is:
 *   - Arrow: navigate to detail in app
 *   - External link: open in Jira/GitLab browser
 *   - X: dismiss notification
 */
import { ArrowRight, ExternalLink, X } from 'lucide-react';
import type { NotificationItem } from '../../stores/notifications.store';

interface NotificationRowProps {
  item: NotificationItem;
  isUnread?: boolean;
  onClick: () => void;
  onNavigate?: () => void;
  onDismiss?: () => void;
  onOpenInBrowser?: () => void;
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

/**
 * Extract issue key from entityTitle. E.g. "PROJ-123: Fix login bug" -> { key: "PROJ-123", title: "Fix login bug" }
 */
function extractIssueKey(entityTitle: string): { key: string | null; title: string } {
  const colonIdx = entityTitle.indexOf(':');
  if (colonIdx > 0) {
    const candidate = entityTitle.slice(0, colonIdx).trim();
    if (/^[A-Z]+-\d+$/.test(candidate)) {
      return { key: candidate, title: entityTitle.slice(colonIdx + 1).trim() };
    }
  }
  return { key: null, title: entityTitle };
}

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
  'pipeline-failure': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  'mr-approval': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  'due-date-reminder': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'issue-assignment': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'issue-update': 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  'jira-comment': 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'mr-note': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'comment-mention': 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  'gitlab-mention': 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
};

function ActionButton({ onClick, title, className, children }: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(e as unknown as React.MouseEvent); }}
      className={`p-0.5 rounded-sm transition-colors cursor-pointer ${className ?? 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
      title={title}
    >
      {children}
    </span>
  );
}

export default function NotificationRow({ item, isUnread = false, onClick, onNavigate, onDismiss, onOpenInBrowser }: NotificationRowProps) {
  const borderClass = item.source === 'jira' ? 'border-orange-500' : 'border-purple-500';
  const typeLabel = item.notificationType ? (labelMap[item.notificationType] ?? item.notificationType) : null;
  const typeColor = item.notificationType ? (colorMap[item.notificationType] ?? 'bg-muted text-muted-foreground') : null;
  const hasActions = onNavigate || onDismiss || (item.url && onOpenInBrowser);
  const { key: issueKey, title: titleText } = extractIssueKey(item.entityTitle);

  // Build body preview for arrow-format changes (single line, dot-separated)
  const isArrowFormat = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left border-l-3 ${borderClass} rounded-md border border-transparent hover:border-border px-3 py-2 density-compact:py-1.5 density-comfortable:py-2.5 transition-colors duration-150 ${
        isUnread ? 'bg-accent/30 hover:bg-accent/50' : 'hover:bg-accent/40'
      }`}
    >
      {/* Top row: avatar + author | source badge | type badge | timestamp/actions */}
      <div className="flex items-center gap-1.5">
        {/* Avatar */}
        <span className="flex-shrink-0 relative">
          {item.authorAvatarUrl ? (
            <img
              src={item.authorAvatarUrl}
              alt={item.author}
              className="w-5 h-5 rounded-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                img.style.display = 'none';
                const sibling = img.nextElementSibling as HTMLElement | null;
                if (sibling) sibling.style.display = 'flex';
              }}
            />
          ) : null}
          <span
            className={`items-center justify-center w-5 h-5 rounded-full text-[9px] font-medium ${
              item.source === 'jira'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
            }`}
            style={{ display: item.authorAvatarUrl ? 'none' : 'flex' }}
          >
            {getInitials(item.author)}
          </span>
        </span>

        {/* Author name */}
        <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[80px]">
          {item.author}
        </span>

        {/* Source badge */}
        {item.source === 'jira' ? (
          <span className="inline-flex items-center text-[9px] font-semibold px-1 py-0 leading-tight rounded-full bg-orange-500 text-white">
            Jira
          </span>
        ) : (
          <span className="inline-flex items-center text-[9px] font-semibold px-1 py-0 leading-tight rounded-full bg-purple-600 text-white">
            GitLab
          </span>
        )}

        {/* Type badge */}
        {typeLabel && typeColor && (
          <span className={`inline-block text-[9px] font-medium px-1 py-0 rounded-sm ${typeColor}`}>
            {typeLabel}
          </span>
        )}

        {/* Right side: unread dot + timestamp (default) / actions (hover) */}
        <span className="ml-auto flex items-center gap-1">
          {/* Unread dot */}
          {isUnread && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 group-hover:hidden" data-testid="unread-dot" />
          )}
          <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap group-hover:hidden">
            {getRelativeTime(item.createdAt)}
          </span>
          {hasActions && (
            <span className="hidden group-hover:flex items-center gap-0.5">
              {onNavigate && (
                <ActionButton
                  onClick={(e) => { e.stopPropagation(); onNavigate(); }}
                  title="Open in app"
                >
                  <ArrowRight className="w-3 h-3" />
                </ActionButton>
              )}
              {item.url && onOpenInBrowser && (
                <ActionButton
                  onClick={(e) => { e.stopPropagation(); onOpenInBrowser(); }}
                  title={item.source === 'jira' ? 'Open in Jira' : 'Open in GitLab'}
                >
                  <ExternalLink className="w-3 h-3" />
                </ActionButton>
              )}
              {onDismiss && (
                <ActionButton
                  onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                  title="Dismiss"
                  className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive p-0.5 rounded-sm transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </ActionButton>
              )}
            </span>
          )}
        </span>
      </div>

      {/* Title line: issue key (mono) + title */}
      <div className="truncate leading-snug text-[13px]">
        {issueKey && (
          <span className="font-mono text-muted-foreground text-[11px] mr-1">{issueKey}</span>
        )}
        <span className={isUnread ? 'font-medium' : 'font-normal text-foreground/80'}>
          {titleText}
        </span>
      </div>

      {/* Body preview — single line */}
      {isArrowFormat ? (
        <p className="text-[11px] text-muted-foreground/70 line-clamp-1">
          {(item.bodyPreview.includes(' | ') ? item.bodyPreview.split(' | ') : [item.bodyPreview]).map((line, i) => {
            const colonIdx = line.indexOf(':');
            const field = colonIdx > 0 ? line.slice(0, colonIdx).trim() : null;
            const rest = colonIdx > 0 ? line.slice(colonIdx + 1).trim() : line;
            const arrowIdx = rest.indexOf('\u2192');
            const from = arrowIdx >= 0 ? rest.slice(0, arrowIdx).trim() : null;
            const to = arrowIdx >= 0 ? rest.slice(arrowIdx + 1).trim() : rest;

            return (
              <span key={i}>
                {i > 0 && <span className="mx-1 text-muted-foreground/40">{'\u00B7'}</span>}
                {field && <span className="font-semibold">{field}: </span>}
                {from !== null ? (
                  <>
                    <span>{from || '(none)'}</span>
                    <span> {'\u2192'} </span>
                    <span className="font-medium">{to || '(none)'}</span>
                  </>
                ) : (
                  <span>{to}</span>
                )}
              </span>
            );
          })}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground/70 line-clamp-1">
          <span dangerouslySetInnerHTML={{ __html: linkifyText(item.bodyPreview) }} />
        </p>
      )}

      {/* Bottom metadata strip: parent key + entity state */}
      {(item.parentKey || item.entityState) && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
          {item.parentKey && (
            <span className="font-mono">{item.parentKey}</span>
          )}
          {item.entityState && (
            <span
              className={`text-[9px] px-1 py-0 rounded-sm border ${
                item.entityState === 'merged'
                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                  : item.entityState === 'closed'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
                    : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
              }`}
            >
              {item.entityState}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
