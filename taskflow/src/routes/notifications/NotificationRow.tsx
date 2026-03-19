/**
 * NotificationRow — notification with source-colored left border.
 *
 * Design:
 * - Left border = source color (orange Jira, purple GitLab)
 * - Unread = blue tinted bg + avatar ring
 * - Avatar with profile picture
 * - Action type as colored badge, then author name, then timestamp
 * - Entity title on second line
 * - Body/changes always in tinted chip style
 * - Parent story as visible chip
 * - Hover: actions float top-right over timestamp
 */
import { Check, ExternalLink, MailOpen, X } from 'lucide-react';
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

/* ── type config — each type gets a colored badge ───── */

const typeConfig: Record<string, { label: string; badge: string }> = {
  'comment-mention': {
    label: 'Mentioned you',
    badge: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  },
  'gitlab-mention': {
    label: 'Mentioned you',
    badge: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  },
  'issue-update': { label: 'Updated', badge: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  'mr-note': { label: 'Commented', badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  'jira-comment': {
    label: 'Commented',
    badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  },
  'mr-approval': { label: 'Approved', badge: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  'pipeline-failure': {
    label: 'Pipeline failed',
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400',
  },
  'issue-assignment': {
    label: 'Assigned to you',
    badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  },
  'due-date-reminder': {
    label: 'Due soon',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
};

const stateConfig: Record<string, { label: string; color: string }> = {
  merged: { label: 'Merged', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  closed: { label: 'Closed', color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  opened: { label: 'Open', color: 'bg-green-500/15 text-green-600 dark:text-green-400' },
};

/* ── body parsing ───────────────────────────────────── */

interface ParsedChange {
  field: string | null;
  from: string | null;
  to: string;
}

/** Parse body into structured changes. Handles both "field: old → new" and "field: value" */
function parseBody(body: string): { isStructured: boolean; changes: ParsedChange[] } {
  const segments = body.includes('\n')
    ? body.split('\n')
    : body.includes(' | ')
      ? body.split(' | ')
      : [body];
  const changes: ParsedChange[] = [];
  let hasStructure = false;

  for (const seg of segments) {
    const ci = seg.indexOf(':');
    const field = ci > 0 ? seg.slice(0, ci).trim() : null;
    const rest = ci > 0 ? seg.slice(ci + 1).trim() : seg;
    const ai = rest.indexOf('\u2192');

    if (ai >= 0) {
      hasStructure = true;
      changes.push({
        field,
        from: rest.slice(0, ai).trim() || null,
        to: rest.slice(ai + 1).trim(),
      });
    } else if (field) {
      hasStructure = true;
      changes.push({ field, from: null, to: rest });
    } else {
      changes.push({ field: null, from: null, to: seg.trim() });
    }
  }

  return { isStructured: hasStructure, changes };
}

/* ── action button ──────────────────────────────────── */

function ActionIcon({
  onClick,
  title,
  children,
  variant = 'default',
}: {
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onClick(e);
        }
      }}
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
  const tc = item.notificationType ? typeConfig[item.notificationType] : null;
  const entityState = item.entityState ? stateConfig[item.entityState] : null;
  const hasActions = onMarkRead || onDismiss || (item.url && onOpenInBrowser);

  const sourceColor = item.source === 'jira' ? 'border-orange-500' : 'border-purple-500';

  // Parse body into structured changes
  const body = item.bodyPreview ? parseBody(item.bodyPreview) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="notification-row"
      className={`group w-full text-left flex gap-3 border-l-[3px] ${sourceColor} pl-3 pr-3 py-2.5 density-compact:py-2 density-comfortable:py-3 transition-colors duration-150 cursor-pointer ${
        isUnread ? 'bg-blue-500/[0.04] hover:bg-blue-500/[0.08]' : 'hover:bg-muted/50'
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
        {/* Line 1: type badge + author + timestamp/actions */}
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 text-[12px] leading-snug">
            {/* Type badge */}
            {tc && (
              <span
                className={`flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-none ${tc.badge}`}
                data-testid="type-badge"
              >
                {tc.label}
              </span>
            )}
            <span
              className={`font-semibold truncate ${isUnread ? 'text-foreground' : 'text-foreground/75'}`}
            >
              {item.author}
            </span>
          </div>

          {/* Top-right: timestamp by default, actions on hover */}
          <div className="flex-shrink-0 relative flex items-center h-5">
            <span className="text-[10px] text-muted-foreground/40 tabular-nums group-hover:opacity-0 transition-opacity duration-100">
              {relTime(item.createdAt)}
            </span>
            {hasActions && (
              <span
                className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                data-testid="action-tray"
              >
                {onMarkRead && (
                  <ActionIcon
                    onClick={() => onMarkRead()}
                    title={isUnread ? 'Mark as read' : 'Mark as unread'}
                  >
                    {isUnread ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <MailOpen className="w-3.5 h-3.5" />
                    )}
                  </ActionIcon>
                )}
                {item.url && onOpenInBrowser && (
                  <ActionIcon
                    onClick={() => onOpenInBrowser()}
                    title={`Open in ${item.source === 'jira' ? 'Jira' : 'GitLab'}`}
                  >
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
            <span
              className={`flex-shrink-0 font-mono text-[10px] ${isUnread ? 'text-muted-foreground/60' : 'text-muted-foreground/40'}`}
            >
              {issueKey}
            </span>
          )}
          <span
            className={`truncate text-[12.5px] leading-snug ${isUnread ? 'font-medium text-foreground' : 'text-foreground/60'}`}
          >
            {title}
          </span>
          {entityState && (
            <span
              className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-semibold leading-none uppercase tracking-wide ${entityState.color}`}
            >
              {entityState.label}
            </span>
          )}
        </div>

        {/* Line 3: body — always chip style, structured when possible */}
        {body &&
          (body.isStructured ? (
            <div className="mt-1 flex flex-col gap-0.5">
              {body.changes.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] leading-snug">
                  {c.field && (
                    <span className="text-muted-foreground/60 font-medium">{c.field}</span>
                  )}
                  {c.from !== null ? (
                    <>
                      <span className="text-muted-foreground/50 bg-red-500/8 px-1 rounded line-through decoration-1">
                        {c.from || '–'}
                      </span>
                      <span className="text-muted-foreground/30">→</span>
                      <span className="text-foreground/70 bg-green-500/8 px-1 rounded font-medium">
                        {c.to || '–'}
                      </span>
                    </>
                  ) : (
                    <span className="text-foreground/60 bg-muted/50 px-1 rounded">{c.to}</span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground/70 bg-muted/40 rounded px-2 py-1 line-clamp-2 leading-relaxed">
              {item.bodyPreview}
            </p>
          ))}

        {/* Parent story context */}
        {item.parentKey && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/50 leading-tight">
            <span className="font-mono">{item.parentKey}</span>
            {item.parentSummary && (
              <>
                <span className="text-muted-foreground/30">/</span>
                <span className="truncate max-w-[220px]">{item.parentSummary}</span>
              </>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
