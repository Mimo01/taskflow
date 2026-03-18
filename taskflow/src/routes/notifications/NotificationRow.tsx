/**
 * NotificationRow — clean notification row.
 *
 * Interactions:
 * - Click  → mark as read + open detail
 * - Hover  → timestamp replaced by action icons (mark read, open external, dismiss)
 *
 * Actions take zero space when not hovered.
 */
import { ExternalLink, Check, X, MailOpen } from 'lucide-react';
import type { NotificationItem } from '../../stores/notifications.store';

/* ── props ──────────────────────────────────────────── */

interface NotificationRowProps {
  item: NotificationItem;
  isUnread?: boolean;
  /** Click = mark read + navigate to detail */
  onClick: () => void;
  /** Mark as read without navigating */
  onMarkRead?: () => void;
  /** Dismiss / remove notification */
  onDismiss?: () => void;
  /** Open in external browser */
  onOpenInBrowser?: () => void;
}

/* ── helpers ────────────────────────────────────────── */

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function splitKey(raw: string): { key: string | null; title: string } {
  const i = raw.indexOf(':');
  if (i > 0 && /^[A-Z]+-\d+$/.test(raw.slice(0, i).trim()))
    return { key: raw.slice(0, i).trim(), title: raw.slice(i + 1).trim() };
  return { key: null, title: raw };
}

/* ── type config ────────────────────────────────────── */

const typeConfig: Record<string, { label: string; color: string }> = {
  'comment-mention':  { label: 'Mentioned',   color: 'bg-pink-500/15 text-pink-600 dark:text-pink-400' },
  'issue-update':     { label: 'Updated',     color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  'mr-note':          { label: 'Comment',     color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  'gitlab-mention':   { label: 'Mentioned',   color: 'bg-pink-500/15 text-pink-600 dark:text-pink-400' },
  'jira-comment':     { label: 'Comment',     color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  'mr-approval':      { label: 'Approved',    color: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  'pipeline-failure': { label: 'Pipeline',    color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  'issue-assignment': { label: 'Assigned',    color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  'due-date-reminder':{ label: 'Due soon',    color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
};

const stateStyle: Record<string, string> = {
  merged: 'text-purple-600 dark:text-purple-400',
  closed: 'text-red-600 dark:text-red-400',
  opened: 'text-green-600 dark:text-green-400',
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
  const tc = item.notificationType ? typeConfig[item.notificationType] : null;
  const hasActions = onMarkRead || onDismiss || (item.url && onOpenInBrowser);

  const isChange = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="notification-row"
      className={`group w-full text-left flex gap-2.5 px-3 py-2.5 density-compact:py-2 density-comfortable:py-3 transition-colors duration-150 cursor-pointer ${
        isUnread
          ? 'bg-primary/[0.03] hover:bg-primary/[0.06]'
          : 'hover:bg-muted/50'
      }`}
    >
      {/* Left: Source badge + unread dot */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
        <span className={`flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-bold tracking-tight leading-none ${
          item.source === 'jira'
            ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
            : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
        }`}>
          {item.source === 'jira' ? 'J' : 'GL'}
        </span>
        {isUnread && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" data-testid="unread-dot" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: type pill + author + time / actions */}
        <div className="flex items-center gap-1.5 text-[11px] leading-none">
          {tc && (
            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none ${tc.color}`}>
              {tc.label}
            </span>
          )}
          <span className="text-muted-foreground/40">from</span>
          <span className={`truncate ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
            {item.author}
          </span>
          {item.entityState && (
            <>
              <span className="text-muted-foreground/25">·</span>
              <span className={`flex-shrink-0 text-[10px] capitalize ${stateStyle[item.entityState] || 'text-muted-foreground'}`}>
                {item.entityState}
              </span>
            </>
          )}

          {/* Right side: timestamp (default) / action icons (hover) */}
          <span className="flex-shrink-0 ml-auto flex items-center">
            {/* Timestamp — visible by default, hidden on hover */}
            <span className="text-[10px] text-muted-foreground/40 tabular-nums group-hover:hidden">
              {relTime(item.createdAt)}
            </span>
            {/* Actions — hidden by default, visible on hover */}
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

        {/* Line 2: issue key + title */}
        <div className="flex items-baseline gap-1.5 mt-1">
          {issueKey && (
            <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/50">{issueKey}</span>
          )}
          {item.parentKey && !issueKey && (
            <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/40">{item.parentKey}</span>
          )}
          <span className={`truncate text-[12.5px] leading-snug ${isUnread ? 'font-medium text-foreground' : 'text-foreground/70'}`}>
            {title}
          </span>
        </div>

        {/* Line 3: body preview */}
        {item.bodyPreview && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/45 truncate leading-snug">
            {isChange ? (
              (item.bodyPreview.includes(' | ') ? item.bodyPreview.split(' | ') : [item.bodyPreview]).map((seg, i) => {
                const ci = seg.indexOf(':');
                const field = ci > 0 ? seg.slice(0, ci).trim() : null;
                const rest = ci > 0 ? seg.slice(ci + 1).trim() : seg;
                const ai = rest.indexOf('\u2192');
                const from = ai >= 0 ? rest.slice(0, ai).trim() : null;
                const to = ai >= 0 ? rest.slice(ai + 1).trim() : rest;
                return (
                  <span key={i}>
                    {i > 0 && <span className="mx-1 text-muted-foreground/20">·</span>}
                    {field && <span className="text-muted-foreground/55">{field}: </span>}
                    {from !== null ? (
                      <>
                        <span className="line-through decoration-muted-foreground/25">{from || '–'}</span>
                        <span className="mx-0.5">→</span>
                        <span className="text-muted-foreground/65 font-medium">{to || '–'}</span>
                      </>
                    ) : (
                      <span>{to}</span>
                    )}
                  </span>
                );
              })
            ) : (
              item.bodyPreview
            )}
          </p>
        )}

        {/* Parent context */}
        {issueKey && item.parentKey && (
          <div className="mt-0.5 text-[10px] text-muted-foreground/35">
            <span className="font-mono">{item.parentKey}</span>
            {item.parentSummary && <span className="ml-1">{item.parentSummary}</span>}
          </div>
        )}
      </div>
    </button>
  );
}
