/**
 * NotificationRow — single notification row in the feed.
 *
 * Design: Two-layer card with source accent, hero title, inline metadata,
 * and a slide-in action tray on hover that overlays the body line.
 *
 * Click = toggle read/unread (stay in popover).
 * Hover reveals action tray with labeled buttons.
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

  if (diffSecs < 60) return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
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
 * Extract issue key from entityTitle.
 * "PROJ-123: Fix login bug" -> { key: "PROJ-123", title: "Fix login bug" }
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
  'issue-update': 'Updated',
  'mr-note': 'MR comment',
  'gitlab-mention': 'Mentioned',
  'jira-comment': 'Comment',
  'mr-approval': 'Approved',
  'pipeline-failure': 'Pipeline',
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

function ActionButton({ onClick, label, icon: Icon, variant = 'default' }: {
  onClick: (e: React.MouseEvent) => void;
  label: string;
  icon: React.FC<{ className?: string }>;
  variant?: 'default' | 'destructive';
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(e as unknown as React.MouseEvent); }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
        variant === 'destructive'
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function NotificationRow({ item, isUnread = false, onClick, onNavigate, onDismiss, onOpenInBrowser }: NotificationRowProps) {
  const accentColor = item.source === 'jira' ? 'border-orange-500' : 'border-purple-500';
  const typeLabel = item.notificationType ? (labelMap[item.notificationType] ?? item.notificationType) : null;
  const typeColor = item.notificationType ? (colorMap[item.notificationType] ?? 'bg-muted text-muted-foreground') : null;
  const hasActions = onNavigate || onDismiss || (item.url && onOpenInBrowser);
  const { key: issueKey, title: titleText } = extractIssueKey(item.entityTitle);

  const isArrowFormat = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left border-l-2 ${accentColor} px-3 py-2 density-compact:py-1.5 density-comfortable:py-2.5 transition-all duration-200 relative ${
        isUnread
          ? 'bg-accent/20 hover:bg-accent/40'
          : 'hover:bg-accent/30'
      }`}
    >
      {/* Row 1: Title line — the hero */}
      <div className="flex items-start gap-2">
        {/* Unread indicator */}
        <div className="flex-shrink-0 w-1.5 mt-[5px]">
          {isUnread && (
            <span className="block w-1.5 h-1.5 rounded-full bg-blue-500" data-testid="unread-dot" />
          )}
        </div>

        {/* Title content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            {issueKey && (
              <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/70">{issueKey}</span>
            )}
            <span className={`truncate text-[13px] leading-tight ${isUnread ? 'font-semibold text-foreground' : 'font-normal text-foreground/80'}`}>
              {titleText}
            </span>
          </div>
        </div>

        {/* Timestamp — always visible, top-right */}
        <span className="flex-shrink-0 text-[10px] text-muted-foreground/50 tabular-nums mt-0.5">
          {getRelativeTime(item.createdAt)}
        </span>
      </div>

      {/* Row 2: Metadata strip — author, source, type, state, parent */}
      <div className="flex items-center gap-1.5 ml-3.5 mt-0.5">
        {/* Avatar */}
        <span className="flex-shrink-0 relative">
          {item.authorAvatarUrl ? (
            <img
              src={item.authorAvatarUrl}
              alt={item.author}
              className="w-4 h-4 rounded-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                img.style.display = 'none';
                const sibling = img.nextElementSibling as HTMLElement | null;
                if (sibling) sibling.style.display = 'flex';
              }}
            />
          ) : null}
          <span
            className={`items-center justify-center w-4 h-4 rounded-full text-[8px] font-medium ${
              item.source === 'jira'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
            }`}
            style={{ display: item.authorAvatarUrl ? 'none' : 'flex' }}
          >
            {getInitials(item.author)}
          </span>
        </span>

        <span className="text-[10px] text-muted-foreground/70 truncate max-w-[72px]">{item.author}</span>

        <span className="text-muted-foreground/20">|</span>

        {/* Source pill */}
        {item.source === 'jira' ? (
          <span className="text-[9px] font-semibold px-1 py-0 leading-tight rounded bg-orange-500/15 text-orange-600 dark:text-orange-400">
            Jira
          </span>
        ) : (
          <span className="text-[9px] font-semibold px-1 py-0 leading-tight rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
            GitLab
          </span>
        )}

        {/* Type badge */}
        {typeLabel && typeColor && (
          <span className={`text-[9px] font-medium px-1 py-0 rounded ${typeColor}`}>
            {typeLabel}
          </span>
        )}

        {/* Entity state chip */}
        {item.entityState && (
          <span
            className={`text-[9px] px-1 py-0 rounded border leading-tight ${
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

        {/* Parent key */}
        {item.parentKey && (
          <>
            <span className="text-muted-foreground/20">|</span>
            <span className="text-[9px] font-mono text-muted-foreground/50">{item.parentKey}</span>
          </>
        )}
      </div>

      {/* Row 3: Body preview + action tray overlay */}
      <div className="relative ml-3.5 mt-0.5 min-h-[18px]">
        {/* Body preview — visible by default, hidden on hover when actions exist */}
        <div className={`transition-opacity duration-150 ${hasActions ? 'group-hover:opacity-0' : ''}`}>
          {isArrowFormat ? (
            <p className="text-[11px] text-muted-foreground/60 line-clamp-1">
              {(item.bodyPreview.includes(' | ') ? item.bodyPreview.split(' | ') : [item.bodyPreview]).map((line, i) => {
                const colonIdx = line.indexOf(':');
                const field = colonIdx > 0 ? line.slice(0, colonIdx).trim() : null;
                const rest = colonIdx > 0 ? line.slice(colonIdx + 1).trim() : line;
                const arrowIdx = rest.indexOf('\u2192');
                const from = arrowIdx >= 0 ? rest.slice(0, arrowIdx).trim() : null;
                const to = arrowIdx >= 0 ? rest.slice(arrowIdx + 1).trim() : rest;

                return (
                  <span key={i}>
                    {i > 0 && <span className="mx-1 text-muted-foreground/30">{'\u00B7'}</span>}
                    {field && <span className="font-medium text-muted-foreground/70">{field}: </span>}
                    {from !== null ? (
                      <>
                        <span>{from || '(none)'}</span>
                        <span className="mx-0.5">{'\u2192'}</span>
                        <span className="font-medium text-muted-foreground/80">{to || '(none)'}</span>
                      </>
                    ) : (
                      <span>{to}</span>
                    )}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 line-clamp-1">
              <span dangerouslySetInnerHTML={{ __html: linkifyText(item.bodyPreview) }} />
            </p>
          )}
        </div>

        {/* Action tray — overlays body on hover */}
        {hasActions && (
          <div
            className="absolute inset-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            data-testid="action-tray"
          >
            {onNavigate && (
              <ActionButton
                onClick={(e) => { e.stopPropagation(); onNavigate(); }}
                label="Open"
                icon={ArrowRight}
              />
            )}
            {item.url && onOpenInBrowser && (
              <ActionButton
                onClick={(e) => { e.stopPropagation(); onOpenInBrowser(); }}
                label={item.source === 'jira' ? 'Jira' : 'GitLab'}
                icon={ExternalLink}
              />
            )}
            {onDismiss && (
              <ActionButton
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                label="Dismiss"
                icon={X}
                variant="destructive"
              />
            )}
          </div>
        )}
      </div>
    </button>
  );
}
