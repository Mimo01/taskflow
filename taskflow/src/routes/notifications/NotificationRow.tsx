/**
 * NotificationRow — single notification in the feed.
 *
 * Design: Minimal, high-density row with clear visual hierarchy.
 * Unread = bold title + blue left accent. Read = muted.
 * Click = mark read/unread. Hover = reveal icon actions on right.
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

function initials(name: string): string {
  if (!name || name === 'Unknown') return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0]?.toUpperCase() ?? '?')
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/** "PROJ-123: Fix login" → { key, title } */
function splitKey(raw: string): { key: string | null; title: string } {
  const i = raw.indexOf(':');
  if (i > 0 && /^[A-Z]+-\d+$/.test(raw.slice(0, i).trim()))
    return { key: raw.slice(0, i).trim(), title: raw.slice(i + 1).trim() };
  return { key: null, title: raw };
}

const typeLabel: Record<string, string> = {
  'comment-mention': 'Mentioned',
  'issue-update': 'Updated',
  'mr-note': 'Comment',
  'gitlab-mention': 'Mentioned',
  'jira-comment': 'Comment',
  'mr-approval': 'Approved',
  'pipeline-failure': 'Pipeline failed',
  'issue-assignment': 'Assigned',
  'due-date-reminder': 'Due soon',
};

const typeStyle: Record<string, string> = {
  'pipeline-failure': 'text-red-600 dark:text-red-400',
  'mr-approval': 'text-green-600 dark:text-green-400',
  'due-date-reminder': 'text-amber-600 dark:text-amber-400',
  'issue-assignment': 'text-blue-600 dark:text-blue-400',
};

const stateStyle: Record<string, string> = {
  merged: 'text-purple-600 dark:text-purple-400',
  closed: 'text-red-600 dark:text-red-400',
  opened: 'text-green-600 dark:text-green-400',
};

/* ── component ──────────────────────────────────────── */

export default function NotificationRow({
  item,
  isUnread = false,
  onClick,
  onNavigate,
  onDismiss,
  onOpenInBrowser,
}: NotificationRowProps) {
  const { key: issueKey, title } = splitKey(item.entityTitle);
  const tLabel = item.notificationType ? typeLabel[item.notificationType] ?? item.notificationType : null;
  const tStyle = item.notificationType ? typeStyle[item.notificationType] ?? '' : '';
  const hasActions = onNavigate || onDismiss || (item.url && onOpenInBrowser);

  // Format body for status changes (field: old → new)
  const isChange = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left relative flex gap-3 px-3 py-2.5 density-compact:py-2 density-comfortable:py-3 transition-colors duration-150 ${
        isUnread
          ? 'bg-primary/[0.03] hover:bg-primary/[0.06]'
          : 'hover:bg-muted/50'
      }`}
    >
      {/* Left accent — thin bar for unread */}
      <div className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-colors duration-150 ${
        isUnread ? 'bg-blue-500' : 'bg-transparent'
      }`} />

      {/* Avatar */}
      <div className="flex-shrink-0 relative mt-0.5">
        {item.authorAvatarUrl ? (
          <img
            src={item.authorAvatarUrl}
            alt={item.author}
            className="w-7 h-7 rounded-full object-cover ring-1 ring-border"
            onError={(e) => {
              const img = e.currentTarget;
              img.style.display = 'none';
              const sib = img.nextElementSibling as HTMLElement | null;
              if (sib) sib.style.display = 'flex';
            }}
          />
        ) : null}
        <span
          className={`items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold ring-1 ring-border ${
            item.source === 'jira'
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
          }`}
          style={{ display: item.authorAvatarUrl ? 'none' : 'flex' }}
        >
          {initials(item.author)}
        </span>
        {/* Source dot — bottom-right of avatar */}
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
          item.source === 'jira' ? 'bg-orange-500' : 'bg-purple-500'
        }`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: author · type · time */}
        <div className="flex items-center gap-1.5 text-[11px] leading-none">
          <span className={`truncate max-w-[120px] ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
            {item.author}
          </span>
          {tLabel && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className={`flex-shrink-0 ${tStyle || 'text-muted-foreground'}`}>{tLabel}</span>
            </>
          )}
          {item.entityState && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className={`flex-shrink-0 capitalize ${stateStyle[item.entityState] || 'text-muted-foreground'}`}>
                {item.entityState}
              </span>
            </>
          )}
          <span className="flex-shrink-0 ml-auto text-[10px] text-muted-foreground/40 tabular-nums">
            {relTime(item.createdAt)}
          </span>
        </div>

        {/* Line 2: issue key + title */}
        <div className="flex items-baseline gap-1.5 mt-1">
          {issueKey && (
            <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/60">{issueKey}</span>
          )}
          {item.parentKey && !issueKey && (
            <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/50">{item.parentKey}</span>
          )}
          <span className={`truncate text-[12.5px] leading-snug ${isUnread ? 'font-medium text-foreground' : 'text-foreground/70'}`}>
            {title}
          </span>
        </div>

        {/* Line 3: body preview */}
        {item.bodyPreview && (
          <div className="mt-0.5">
            {isChange ? (
              <p className="text-[11px] text-muted-foreground/50 truncate leading-snug">
                {(item.bodyPreview.includes(' | ') ? item.bodyPreview.split(' | ') : [item.bodyPreview]).map((seg, i) => {
                  const ci = seg.indexOf(':');
                  const field = ci > 0 ? seg.slice(0, ci).trim() : null;
                  const rest = ci > 0 ? seg.slice(ci + 1).trim() : seg;
                  const ai = rest.indexOf('\u2192');
                  const from = ai >= 0 ? rest.slice(0, ai).trim() : null;
                  const to = ai >= 0 ? rest.slice(ai + 1).trim() : rest;
                  return (
                    <span key={i}>
                      {i > 0 && <span className="mx-1 text-muted-foreground/25">·</span>}
                      {field && <span className="text-muted-foreground/60">{field}: </span>}
                      {from !== null ? (
                        <>
                          <span className="line-through decoration-muted-foreground/30">{from || '–'}</span>
                          <span className="mx-0.5 text-muted-foreground/40">→</span>
                          <span className="text-muted-foreground/70 font-medium">{to || '–'}</span>
                        </>
                      ) : (
                        <span>{to}</span>
                      )}
                    </span>
                  );
                })}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/50 truncate leading-snug">
                {item.bodyPreview}
              </p>
            )}
          </div>
        )}

        {/* Parent context — shown below body when issue key is present and parent exists */}
        {issueKey && item.parentKey && (
          <div className="mt-0.5 text-[10px] text-muted-foreground/40">
            <span className="font-mono">{item.parentKey}</span>
            {item.parentSummary && <span className="ml-1">{item.parentSummary}</span>}
          </div>
        )}
      </div>

      {/* Actions — appear on right on hover */}
      {hasActions && (
        <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 -mr-1" data-testid="action-tray">
          {onNavigate && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onNavigate(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onNavigate(); } }}
              title="Open in app"
              className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          )}
          {item.url && onOpenInBrowser && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onOpenInBrowser(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenInBrowser(); } }}
              title={`Open in ${item.source === 'jira' ? 'Jira' : 'GitLab'}`}
              className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          )}
          {onDismiss && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDismiss(); } }}
              title="Dismiss"
              className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      )}
    </button>
  );
}
