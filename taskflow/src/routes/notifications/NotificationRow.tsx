/**
 * NotificationRow — GitHub/Linear-style notification.
 *
 * Design:
 * - Avatar as primary visual anchor, with source dot overlay
 * - First line reads as a sentence: "John mentioned you · 3m"
 * - Entity title is prominent on second line
 * - Body preview as subtle third line
 * - Hover reveals actions in place of timestamp
 */
import { ExternalLink, Check, X, MailOpen } from 'lucide-react';
import type { NotificationItem } from '../../stores/notifications.store';

/* ── props ──────────────────────────────────────────── */

interface NotificationRowProps {
  item: NotificationItem;
  isUnread?: boolean;
  onClick: () => void;
  onMarkRead?: () => void;
  onDismiss?: () => void;
  onOpenInBrowser?: () => void;
}

/* ── helpers ────────────────────────────────────────── */

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function initials(name: string): string {
  if (!name || name === 'Unknown') return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0]?.toUpperCase() ?? '?')
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function splitKey(raw: string): { key: string | null; title: string } {
  const i = raw.indexOf(':');
  if (i > 0 && /^[A-Z]+-\d+$/.test(raw.slice(0, i).trim()))
    return { key: raw.slice(0, i).trim(), title: raw.slice(i + 1).trim() };
  return { key: null, title: raw };
}

/** Human-readable verb for the notification type */
const actionVerb: Record<string, string> = {
  'comment-mention': 'mentioned you in',
  'gitlab-mention': 'mentioned you in',
  'issue-update': 'updated',
  'mr-note': 'commented on',
  'jira-comment': 'commented on',
  'mr-approval': 'approved',
  'pipeline-failure': 'pipeline failed on',
  'issue-assignment': 'assigned you to',
  'due-date-reminder': 'is due soon:',
};

/** Color for the notification type verb */
const verbColor: Record<string, string> = {
  'comment-mention': 'text-pink-600 dark:text-pink-400',
  'gitlab-mention': 'text-pink-600 dark:text-pink-400',
  'mr-approval': 'text-green-600 dark:text-green-400',
  'pipeline-failure': 'text-red-600 dark:text-red-400',
  'issue-assignment': 'text-blue-600 dark:text-blue-400',
  'due-date-reminder': 'text-amber-600 dark:text-amber-400',
};

const stateConfig: Record<string, { label: string; color: string }> = {
  merged: { label: 'Merged', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  closed: { label: 'Closed', color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  opened: { label: 'Open', color: 'bg-green-500/15 text-green-600 dark:text-green-400' },
};

/* ── action button ──────────────────────────────────── */

function ActionIcon({ onClick, title, children, variant = 'default' }: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onClick(e as unknown as React.MouseEvent); } }}
      title={title}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors cursor-pointer ${
        variant === 'destructive'
          ? 'text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground/50 hover:text-foreground hover:bg-accent'
      }`}
    >
      {children}
    </span>
  );
}

/* ── component ──────────────────────────────────────── */

export default function NotificationRow({
  item,
  isUnread = false,
  onClick,
  onMarkRead,
  onDismiss,
  onOpenInBrowser,
}: NotificationRowProps) {
  const { key: issueKey, title } = splitKey(item.entityTitle);
  const verb = item.notificationType ? actionVerb[item.notificationType] ?? null : null;
  const vColor = item.notificationType ? verbColor[item.notificationType] ?? '' : '';
  const state = item.entityState ? stateConfig[item.entityState] : null;
  const hasActions = onMarkRead || onDismiss || (item.url && onOpenInBrowser);

  const isChange = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="notification-row"
      className={`group w-full text-left flex gap-3 pl-0 pr-3 py-2.5 density-compact:py-2 density-comfortable:py-3 transition-colors duration-150 cursor-pointer ${
        isUnread
          ? 'bg-primary/[0.03] hover:bg-primary/[0.07]'
          : 'hover:bg-muted/50'
      }`}
    >
      {/* Unread accent bar — left edge */}
      <div className={`flex-shrink-0 w-[3px] self-stretch rounded-r-full transition-colors ${
        isUnread ? 'bg-blue-500' : 'bg-transparent'
      }`} data-testid={isUnread ? 'unread-bar' : undefined} />

      {/* Avatar with source indicator */}
      <div className="flex-shrink-0 relative mt-0.5">
        {item.authorAvatarUrl ? (
          <img
            src={item.authorAvatarUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
            onError={(e) => {
              const img = e.currentTarget;
              img.style.display = 'none';
              const fallback = img.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <span
          className={`items-center justify-center w-8 h-8 rounded-full text-[11px] font-semibold ${
            item.source === 'jira'
              ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
              : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
          }`}
          style={{ display: item.authorAvatarUrl ? 'none' : 'flex' }}
        >
          {initials(item.author)}
        </span>
        {/* Source dot overlay — bottom-right */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2px] border-background flex items-center justify-center text-[6px] font-bold text-white ${
            item.source === 'jira' ? 'bg-orange-500' : 'bg-purple-500'
          }`}
          data-testid="source-dot"
        >
          {item.source === 'jira' ? 'J' : 'G'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: "Author verb · time" — reads as a sentence */}
        <div className="flex items-center gap-0 text-[12px] leading-snug">
          <span className="flex items-center gap-1 min-w-0">
            <span className={`font-semibold truncate max-w-[130px] ${isUnread ? 'text-foreground' : 'text-foreground/80'}`}>
              {item.author}
            </span>
            {verb && (
              <span className={`flex-shrink-0 ${vColor || 'text-muted-foreground/70'}`}>
                {verb}
              </span>
            )}
          </span>

          {/* Right: timestamp / actions */}
          <span className="flex-shrink-0 ml-auto flex items-center pl-2">
            <span className="text-[10px] text-muted-foreground/40 tabular-nums group-hover:hidden">
              {relTime(item.createdAt)}
            </span>
            {hasActions && (
              <span className="hidden group-hover:inline-flex items-center gap-0.5" data-testid="action-tray">
                {onMarkRead && (
                  <ActionIcon onClick={() => onMarkRead()} title={isUnread ? 'Mark as read' : 'Mark as unread'}>
                    {isUnread ? <Check className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                  </ActionIcon>
                )}
                {item.url && onOpenInBrowser && (
                  <ActionIcon onClick={() => onOpenInBrowser()} title={`Open in ${item.source === 'jira' ? 'Jira' : 'GitLab'}`}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </ActionIcon>
                )}
                {onDismiss && (
                  <ActionIcon onClick={() => onDismiss()} title="Dismiss" variant="destructive">
                    <X className="w-3.5 h-3.5" />
                  </ActionIcon>
                )}
              </span>
            )}
          </span>
        </div>

        {/* Line 2: entity — key + title + state badge */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {issueKey && (
            <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/50">{issueKey}</span>
          )}
          <span className={`truncate text-[12.5px] leading-snug ${isUnread ? 'font-medium text-foreground' : 'text-foreground/65'}`}>
            {title}
          </span>
          {state && (
            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-semibold leading-none uppercase tracking-wide ${state.color}`}>
              {state.label}
            </span>
          )}
        </div>

        {/* Line 3: changes or body — more prominent */}
        {item.bodyPreview && (
          isChange ? (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {(item.bodyPreview.includes(' | ') ? item.bodyPreview.split(' | ') : [item.bodyPreview]).map((seg, i) => {
                const ci = seg.indexOf(':');
                const field = ci > 0 ? seg.slice(0, ci).trim() : null;
                const rest = ci > 0 ? seg.slice(ci + 1).trim() : seg;
                const ai = rest.indexOf('\u2192');
                const from = ai >= 0 ? rest.slice(0, ai).trim() : null;
                const to = ai >= 0 ? rest.slice(ai + 1).trim() : rest;
                return (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] leading-snug">
                    {field && <span className="text-muted-foreground/60 font-medium">{field}</span>}
                    {from !== null ? (
                      <>
                        <span className="text-muted-foreground/40 bg-red-500/8 px-1 rounded line-through decoration-1">{from || '–'}</span>
                        <span className="text-muted-foreground/30">→</span>
                        <span className="text-foreground/70 bg-green-500/8 px-1 rounded font-medium">{to || '–'}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/50">{to}</span>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground/50 line-clamp-2 leading-relaxed">
              {item.bodyPreview}
            </p>
          )
        )}

        {/* Parent context */}
        {issueKey && item.parentKey && (
          <div className="mt-0.5 text-[10px] text-muted-foreground/30 truncate">
            in <span className="font-mono">{item.parentKey}</span>
            {item.parentSummary && <span> {item.parentSummary}</span>}
          </div>
        )}
      </div>
    </button>
  );
}
