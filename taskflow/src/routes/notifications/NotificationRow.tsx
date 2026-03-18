/**
 * NotificationRow — Apple-style swipeable notification.
 *
 * Interactions:
 * - Click       → mark as read + open detail
 * - Swipe right → reveals "Read" action button; full swipe auto-triggers
 * - Swipe left  → reveals "Delete" action button; full swipe auto-triggers
 * - Hover       → small external-link icon (only when url exists)
 *
 * Swipe behaviour mirrors iOS Mail:
 * - Short swipe snaps open to reveal tappable action button
 * - Full swipe past 50% auto-triggers the action
 * - Tap action button or tap elsewhere to close
 * - Row slides out on delete with height collapse
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { ExternalLink, CheckCheck, Trash2, BookOpen } from 'lucide-react';
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

/* ── swipe constants ────────────────────────────────── */

const ACTION_WIDTH = 72;       // px — width of the revealed action button
const FULL_SWIPE_RATIO = 0.5;  // swipe past 50% of row width → auto-trigger
const DEADZONE = 6;            // px before deciding swipe vs scroll
const SPRING = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)'; // Apple-style spring
const COLLAPSE = 'height 300ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms ease-out';

type SwipeState = 'idle' | 'dragging' | 'snapped-right' | 'snapped-left' | 'completing' | 'dismissed';

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

  const [offsetX, setOffsetX] = useState(0);
  const [state, setState] = useState<SwipeState>('idle');
  const [rowHeight, setRowHeight] = useState<number | undefined>(undefined);
  const pointerRef = useRef<{
    startX: number;
    startY: number;
    decided: boolean;
    isSwiping: boolean;
    pointerId: number;
  } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Measure row height for collapse animation
  useEffect(() => {
    if (state === 'completing' && rowRef.current && rowHeight === undefined) {
      setRowHeight(rowRef.current.offsetHeight);
    }
  }, [state, rowHeight]);

  const getRowWidth = useCallback(() => rowRef.current?.offsetWidth ?? 400, []);

  const snapBack = useCallback(() => {
    setState('idle');
    setOffsetX(0);
  }, []);

  const completeAction = useCallback((action: 'read' | 'dismiss') => {
    setState('completing');
    // Slide fully off-screen in the action direction
    setOffsetX(action === 'read' ? getRowWidth() : -getRowWidth());

    const el = rowRef.current;
    if (el) setRowHeight(el.offsetHeight);

    setTimeout(() => {
      setState('dismissed');
      if (action === 'read') onMarkRead?.();
      else onDismiss?.();
    }, 350);
  }, [getRowWidth, onMarkRead, onDismiss]);

  /* ── pointer handlers ────────────────────────────── */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // If snapped open, a tap elsewhere should close it
    if (state === 'snapped-right' || state === 'snapped-left') {
      snapBack();
      e.preventDefault();
      return;
    }
    if (state !== 'idle') return;
    pointerRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      decided: false,
      isSwiping: false,
      pointerId: e.pointerId,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [state, snapBack]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ref = pointerRef.current;
    if (!ref || state !== 'idle') return;

    const dx = e.clientX - ref.startX;
    const dy = e.clientY - ref.startY;

    if (!ref.decided) {
      if (Math.abs(dy) > DEADZONE) {
        // Vertical scroll — bail
        pointerRef.current = null;
        return;
      }
      if (Math.abs(dx) > DEADZONE) {
        ref.decided = true;
        ref.isSwiping = true;
        setState('dragging');
      } else {
        return;
      }
    }

    // Only allow directions that have handlers
    let clamped = dx;
    if (dx > 0 && !onMarkRead) clamped = 0;
    if (dx < 0 && !onDismiss) clamped = 0;

    setOffsetX(clamped);
  }, [state, onMarkRead, onDismiss]);

  const handlePointerUp = useCallback(() => {
    const ref = pointerRef.current;
    const wasSwiping = ref?.isSwiping ?? false;
    pointerRef.current = null;

    if (!wasSwiping || state !== 'dragging') {
      if (state === 'dragging') snapBack();
      return;
    }

    const rowWidth = getRowWidth();
    const absX = Math.abs(offsetX);

    // Full swipe past 50% → auto-trigger
    if (offsetX > 0 && absX > rowWidth * FULL_SWIPE_RATIO && onMarkRead) {
      completeAction('read');
      return;
    }
    if (offsetX < 0 && absX > rowWidth * FULL_SWIPE_RATIO && onDismiss) {
      completeAction('dismiss');
      return;
    }

    // Past action button width → snap to show action button
    if (offsetX > ACTION_WIDTH && onMarkRead) {
      setState('snapped-right');
      setOffsetX(ACTION_WIDTH);
      return;
    }
    if (offsetX < -ACTION_WIDTH && onDismiss) {
      setState('snapped-left');
      setOffsetX(-ACTION_WIDTH);
      return;
    }

    // Below threshold → snap back
    snapBack();
  }, [state, offsetX, getRowWidth, onMarkRead, onDismiss, completeAction, snapBack]);

  const handleClick = useCallback(() => {
    if (state !== 'idle') return;
    onClick();
  }, [state, onClick]);

  /* ── render ──────────────────────────────────────── */

  if (state === 'dismissed') return null;

  const isChange = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  const animating = state !== 'dragging';
  const showRight = offsetX > 0;
  const showLeft = offsetX < 0;

  return (
    <div
      ref={rowRef}
      className="relative overflow-hidden"
      data-testid="notification-row"
      style={state === 'completing' ? {
        height: rowHeight,
        transition: COLLAPSE,
        ...(rowHeight !== undefined ? { height: 0, opacity: 0 } : {}),
      } : undefined}
    >
      {/* Right action: Mark Read (blue) — behind, left-aligned */}
      {showRight && (
        <div
          className="absolute inset-y-0 left-0 flex items-center bg-blue-500"
          style={{ width: Math.max(offsetX, ACTION_WIDTH) }}
        >
          <button
            type="button"
            onClick={() => completeAction('read')}
            className="flex flex-col items-center justify-center gap-1 w-[72px] h-full text-white"
            data-testid="action-mark-read"
          >
            {isUnread ? (
              <CheckCheck className="w-5 h-5" />
            ) : (
              <BookOpen className="w-5 h-5" />
            )}
            <span className="text-[10px] font-medium leading-none">
              {isUnread ? 'Read' : 'Unread'}
            </span>
          </button>
        </div>
      )}

      {/* Left action: Delete (red) — behind, right-aligned */}
      {showLeft && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500 transition-colors duration-150"
          style={{ width: Math.max(Math.abs(offsetX), ACTION_WIDTH) }}
        >
          <button
            type="button"
            onClick={() => completeAction('dismiss')}
            className="flex flex-col items-center justify-center gap-1 w-[72px] h-full text-white"
            data-testid="action-dismiss"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">Delete</span>
          </button>
        </div>
      )}

      {/* Slideable row content */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointerRef.current = null; snapBack(); }}
        className={`group relative w-full text-left flex gap-2.5 px-3 py-2.5 density-compact:py-2 density-comfortable:py-3 cursor-pointer select-none ${
          isUnread
            ? 'bg-background hover:bg-muted/40'
            : 'bg-background hover:bg-muted/30'
        }`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: animating ? SPRING : 'none',
          touchAction: state === 'dragging' ? 'none' : 'pan-y',
        }}
      >
        {/* Left: Source + unread indicator */}
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
          {/* Line 1: type pill + author + time */}
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
            <span className="flex-shrink-0 ml-auto text-[10px] text-muted-foreground/40 tabular-nums">
              {relTime(item.createdAt)}
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

        {/* Hover: open in browser — zero space when hidden */}
        {item.url && onOpenInBrowser && (
          <div
            className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            data-testid="external-action"
          >
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onOpenInBrowser(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenInBrowser(); } }}
              title={`Open in ${item.source === 'jira' ? 'Jira' : 'GitLab'}`}
              className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
