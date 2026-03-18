/**
 * NotificationRow — single notification in the feed.
 *
 * Interactions:
 * - Click      → mark as read + open detail
 * - Swipe right → mark as read (without opening)
 * - Swipe left  → dismiss / delete
 * - Hover       → small "open in browser" icon (only if url exists)
 *
 * No actions take space when not active.
 */
import { useRef, useState, useCallback } from 'react';
import { ExternalLink, Check, Trash2 } from 'lucide-react';
import type { NotificationItem } from '../../stores/notifications.store';

/* ── props ──────────────────────────────────────────── */

interface NotificationRowProps {
  item: NotificationItem;
  isUnread?: boolean;
  /** Click = mark read + navigate to detail */
  onClick: () => void;
  /** Swipe-right = mark as read without navigating */
  onMarkRead?: () => void;
  /** Swipe-left = dismiss notification */
  onDismiss?: () => void;
  /** Hover action = open in external browser */
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

const SWIPE_THRESHOLD = 72;   // px to trigger action
const SWIPE_DEADZONE = 6;     // px before we decide it's a swipe
const SPRING_DURATION = 250;  // ms for snap-back

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

  // Swipe state
  const [offsetX, setOffsetX] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pointerRef = useRef<{ startX: number; startY: number; swiping: boolean; pointerId: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const resetSwipe = useCallback(() => {
    setTransitioning(true);
    setOffsetX(0);
    setTimeout(() => setTransitioning(false), SPRING_DURATION);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only primary button (left click / single touch)
    if (e.button !== 0) return;
    pointerRef.current = { startX: e.clientX, startY: e.clientY, swiping: false, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ref = pointerRef.current;
    if (!ref) return;

    const dx = e.clientX - ref.startX;
    const dy = e.clientY - ref.startY;

    // Decide if this is a swipe or scroll
    if (!ref.swiping) {
      if (Math.abs(dy) > SWIPE_DEADZONE) {
        // Vertical — let the scroll container handle it
        pointerRef.current = null;
        return;
      }
      if (Math.abs(dx) > SWIPE_DEADZONE) {
        ref.swiping = true;
      } else {
        return;
      }
    }

    // Clamp: right swipe only if onMarkRead, left only if onDismiss
    let clamped = dx;
    if (dx > 0 && !onMarkRead) clamped = 0;
    if (dx < 0 && !onDismiss) clamped = 0;
    // Rubber-band past threshold
    if (Math.abs(clamped) > SWIPE_THRESHOLD) {
      const over = Math.abs(clamped) - SWIPE_THRESHOLD;
      clamped = (clamped > 0 ? 1 : -1) * (SWIPE_THRESHOLD + over * 0.3);
    }

    setOffsetX(clamped);
  }, [onMarkRead, onDismiss]);

  const handlePointerUp = useCallback(() => {
    const ref = pointerRef.current;
    const wasSwiping = ref?.swiping ?? false;
    pointerRef.current = null;

    if (!wasSwiping) {
      setOffsetX(0);
      return; // Was a click — onClick handled by the button
    }

    // Swipe right → mark read
    if (offsetX >= SWIPE_THRESHOLD && onMarkRead) {
      onMarkRead();
      resetSwipe();
      return;
    }

    // Swipe left → dismiss with slide-out animation
    if (offsetX <= -SWIPE_THRESHOLD && onDismiss) {
      setTransitioning(true);
      setOffsetX(-400);
      setTimeout(() => {
        setDismissed(true);
        onDismiss();
      }, SPRING_DURATION);
      return;
    }

    // Below threshold — snap back
    resetSwipe();
  }, [offsetX, onMarkRead, onDismiss, resetSwipe]);

  // Prevent click when swiping
  const handleClick = useCallback(() => {
    // If we were swiping, don't fire click
    if (Math.abs(offsetX) > SWIPE_DEADZONE) return;
    onClick();
  }, [onClick, offsetX]);

  if (dismissed) return null;

  // Format body for status changes
  const isChange = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  const swipeActive = Math.abs(offsetX) > SWIPE_DEADZONE;
  const rightRevealed = offsetX > SWIPE_DEADZONE;
  const leftRevealed = offsetX < -SWIPE_DEADZONE;
  const rightTriggered = offsetX >= SWIPE_THRESHOLD;
  const leftTriggered = offsetX <= -SWIPE_THRESHOLD;

  return (
    <div
      ref={rowRef}
      className="relative overflow-hidden"
      data-testid="notification-row"
    >
      {/* Swipe-right background: Mark read (blue) */}
      {rightRevealed && (
        <div className={`absolute inset-0 flex items-center pl-4 transition-colors duration-150 ${
          rightTriggered ? 'bg-blue-500' : 'bg-blue-500/20'
        }`}>
          <Check className={`w-4 h-4 transition-colors ${rightTriggered ? 'text-white' : 'text-blue-500'}`} />
          <span className={`ml-2 text-xs font-medium transition-colors ${rightTriggered ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>
            Mark read
          </span>
        </div>
      )}

      {/* Swipe-left background: Dismiss (red) */}
      {leftRevealed && (
        <div className={`absolute inset-0 flex items-center justify-end pr-4 transition-colors duration-150 ${
          leftTriggered ? 'bg-red-500' : 'bg-red-500/20'
        }`}>
          <span className={`mr-2 text-xs font-medium transition-colors ${leftTriggered ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>
            Dismiss
          </span>
          <Trash2 className={`w-4 h-4 transition-colors ${leftTriggered ? 'text-white' : 'text-red-500'}`} />
        </div>
      )}

      {/* Slideable row content */}
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointerRef.current = null; resetSwipe(); }}
        className={`group relative w-full text-left flex gap-2.5 px-3 py-2.5 density-compact:py-2 density-comfortable:py-3 cursor-pointer select-none ${
          isUnread
            ? 'bg-background hover:bg-muted/40'
            : 'bg-background hover:bg-muted/30'
        }`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: transitioning ? `transform ${SPRING_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1)` : 'none',
          touchAction: swipeActive ? 'none' : 'pan-y',
        }}
      >
        {/* Left: Source + unread indicator */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
          {/* Source badge — always visible, colored */}
          <span className={`flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-bold tracking-tight leading-none ${
            item.source === 'jira'
              ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
              : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
          }`}>
            {item.source === 'jira' ? 'J' : 'GL'}
          </span>
          {/* Unread dot */}
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

        {/* Hover: open in browser — only icon, zero width when hidden */}
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
      </button>
    </div>
  );
}
