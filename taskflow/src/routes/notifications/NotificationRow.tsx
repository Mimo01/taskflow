/**
 * NotificationRow — notification with source-colored left border.
 *
 * Design:
 * - Left border = source color (orange Jira, purple GitLab)
 * - Unread = bolder text + tinted background
 * - Avatar with profile picture
 * - Sentence: "Author verb · time"
 * - Entity title on second line
 * - Body/changes in tinted chip style
 * - Parent story as visible chip
 * - Hover: actions float top-right over timestamp
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

/* ── type config ────────────────────────────────────── */

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
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer ${
        variant === 'destructive'
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
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
  const entityState = item.entityState ? stateConfig[item.entityState] : null;
  const hasActions = onMarkRead || onDismiss || (item.url && onOpenInBrowser);

  const isChange = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  const sourceColor = item.source === 'jira' ? 'border-orange-500' : 'border-purple-500';

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="notification-row"
      className={`group w-full text-left flex gap-3 border-l-[3px] ${sourceColor} pl-3 pr-3 py-2.5 density-compact:py-2 density-comfortable:py-3 transition-colors duration-150 cursor-pointer ${
        isUnread
          ? 'bg-blue-500/[0.04] hover:bg-blue-500/[0.08]'
          : 'hover:bg-muted/50'
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 relative mt-0.5">
        {item.authorAvatarUrl ? (
          <img
            src={item.authorAvatarUrl}
            alt=""
            className={`w-8 h-8 rounded-full object-cover ${isUnread ? 'ring-2 ring-blue-500/30' : ''}`}
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
            isUnread ? 'ring-2 ring-blue-500/30' : ''
          } ${
            item.source === 'jira'
              ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
              : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
          }`}
          style={{ display: item.authorAvatarUrl ? 'none' : 'flex' }}
        >
          {initials(item.author)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: "Author verb" + timestamp/actions top-right */}
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1 text-[12px] leading-snug">
            <span className={`font-semibold ${isUnread ? 'text-foreground' : 'text-foreground/75'}`}>
              {item.author}
            </span>
            {verb && (
              <span className={`${vColor || 'text-muted-foreground/60'}`}>
                {verb}
              </span>
            )}
          </div>

          {/* Top-right: timestamp by default, actions on hover */}
          <div className="flex-shrink-0 relative flex items-center h-5">
            {/* Timestamp */}
            <span className="text-[10px] text-muted-foreground/40 tabular-nums group-hover:opacity-0 transition-opacity duration-100">
              {relTime(item.createdAt)}
            </span>
            {/* Actions — absolutely positioned over timestamp */}
            {hasActions && (
              <span
                className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100 bg-inherit"
                data-testid="action-tray"
              >
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
          </div>
        </div>

        {/* Line 2: entity — key + title + state badge */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {issueKey && (
            <span className={`flex-shrink-0 font-mono text-[10px] ${isUnread ? 'text-muted-foreground/60' : 'text-muted-foreground/40'}`}>{issueKey}</span>
          )}
          <span className={`truncate text-[12.5px] leading-snug ${isUnread ? 'font-medium text-foreground' : 'text-foreground/60'}`}>
            {title}
          </span>
          {entityState && (
            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-semibold leading-none uppercase tracking-wide ${entityState.color}`}>
              {entityState.label}
            </span>
          )}
        </div>

        {/* Line 3: body — tinted chip style for all types */}
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
                        <span className="text-muted-foreground/50 bg-red-500/8 px-1 rounded line-through decoration-1">{from || '–'}</span>
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
            <p className="mt-1 text-[11px] text-muted-foreground/70 bg-muted/40 rounded px-2 py-1 line-clamp-2 leading-relaxed">
              {item.bodyPreview}
            </p>
          )
        )}

        {/* Parent story — visible chip */}
        {item.parentKey && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] bg-muted/50 rounded-md px-2 py-0.5">
            <span className="text-muted-foreground/50">Parent</span>
            <span className="font-mono font-medium text-foreground/60">{item.parentKey}</span>
            {item.parentSummary && (
              <span className="text-muted-foreground/60 truncate max-w-[180px]">{item.parentSummary}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
