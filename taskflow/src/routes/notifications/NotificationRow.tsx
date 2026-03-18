/**
 * NotificationRow — Apple-style swipeable notification.
 *
 * Interactions:
 * - Click       → mark as read + open detail
 * - Swipe right → reveals "Read" action; full swipe auto-triggers
 * - Swipe left  → reveals "Delete" action; full swipe auto-triggers
 * - Hover       → small external-link icon (only when url exists)
 *
 * Swipe uses mousedown + document mousemove/mouseup for reliable
 * drag tracking in Tauri webview. All drag state is in refs to avoid
 * re-render per pixel; only visual offset uses state via rAF.
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

const ACTION_WIDTH = 80;
const FULL_SWIPE_RATIO = 0.45;
const DEADZONE = 5;
const SPRING = 'transform 400ms cubic-bezier(0.25, 1, 0.5, 1)';
const COLLAPSE = 'max-height 300ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms ease-out';

type VisualState = 'idle' | 'snapped-right' | 'snapped-left' | 'completing' | 'dismissed';

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

  // Visual state (not drag tracking — that's all refs)
  const [offsetX, setOffsetX] = useState(0);
  const [visualState, setVisualState] = useState<VisualState>('idle');
  const [animate, setAnimate] = useState(false);

  // Refs for drag tracking — no re-renders during drag
  const rowRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const rightBgRef = useRef<HTMLDivElement>(null);
  const leftBgRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    decided: boolean;
    isSwiping: boolean;
    currentX: number;
  } | null>(null);

  const getRowWidth = useCallback(() => rowRef.current?.offsetWidth ?? 400, []);

  // Apply transform directly to DOM during drag (no React re-render)
  const applyOffset = useCallback((x: number) => {
    if (slideRef.current) {
      slideRef.current.style.transform = `translateX(${x}px)`;
    }
    if (rightBgRef.current) {
      rightBgRef.current.style.display = x > 0 ? 'flex' : 'none';
      rightBgRef.current.style.width = `${Math.max(x, ACTION_WIDTH)}px`;
    }
    if (leftBgRef.current) {
      leftBgRef.current.style.display = x < 0 ? 'flex' : 'none';
      leftBgRef.current.style.width = `${Math.max(Math.abs(x), ACTION_WIDTH)}px`;
    }
  }, []);

  const snapBack = useCallback(() => {
    setAnimate(true);
    setOffsetX(0);
    setVisualState('idle');
  }, []);

  const completeAction = useCallback((action: 'read' | 'dismiss') => {
    setAnimate(true);
    setVisualState('completing');
    setOffsetX(action === 'read' ? getRowWidth() + 20 : -(getRowWidth() + 20));

    setTimeout(() => {
      setVisualState('dismissed');
      if (action === 'read') onMarkRead?.();
      else onDismiss?.();
    }, 400);
  }, [getRowWidth, onMarkRead, onDismiss]);

  /* ── mouse-based drag ────────────────────────────── */

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // If snapped open, tap closes it
    if (visualState === 'snapped-right' || visualState === 'snapped-left') {
      snapBack();
      e.preventDefault();
      return;
    }
    if (visualState !== 'idle') return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      decided: false,
      isSwiping: false,
      currentX: 0,
    };

    // Disable transition during drag
    if (slideRef.current) slideRef.current.style.transition = 'none';

    const onMouseMove = (me: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = me.clientX - drag.startX;
      const dy = me.clientY - drag.startY;

      if (!drag.decided) {
        if (Math.abs(dy) > DEADZONE) {
          // Vertical — bail, let scroll handle it
          dragRef.current = null;
          return;
        }
        if (Math.abs(dx) > DEADZONE) {
          drag.decided = true;
          drag.isSwiping = true;
          // Prevent text selection during swipe
          e.preventDefault();
        } else {
          return;
        }
      }

      // Clamp directions that have no handler
      let clamped = dx;
      if (dx > 0 && !onMarkRead) clamped = 0;
      if (dx < 0 && !onDismiss) clamped = 0;

      drag.currentX = clamped;
      applyOffset(clamped);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const drag = dragRef.current;
      dragRef.current = null;

      if (!drag || !drag.isSwiping) return;

      const x = drag.currentX;
      const rowWidth = getRowWidth();
      const absX = Math.abs(x);

      // Re-enable transitions
      if (slideRef.current) slideRef.current.style.transition = SPRING;

      // Full swipe past threshold → auto-trigger
      if (x > 0 && absX > rowWidth * FULL_SWIPE_RATIO && onMarkRead) {
        setOffsetX(x); // sync React state
        completeAction('read');
        return;
      }
      if (x < 0 && absX > rowWidth * FULL_SWIPE_RATIO && onDismiss) {
        setOffsetX(x);
        completeAction('dismiss');
        return;
      }

      // Past action width → snap to show action button
      if (x > ACTION_WIDTH && onMarkRead) {
        setAnimate(true);
        setOffsetX(ACTION_WIDTH);
        setVisualState('snapped-right');
        return;
      }
      if (x < -ACTION_WIDTH && onDismiss) {
        setAnimate(true);
        setOffsetX(-ACTION_WIDTH);
        setVisualState('snapped-left');
        return;
      }

      // Below threshold → snap back
      setAnimate(true);
      setOffsetX(0);
      setVisualState('idle');
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [visualState, snapBack, onMarkRead, onDismiss, applyOffset, getRowWidth, completeAction]);

  // Sync React state → DOM for animated transitions (snap, complete)
  useEffect(() => {
    if (!animate) return;
    applyOffset(offsetX);
    const id = setTimeout(() => setAnimate(false), 450);
    return () => clearTimeout(id);
  }, [offsetX, animate, applyOffset]);

  // Re-enable transition when animate is true
  useEffect(() => {
    if (animate && slideRef.current) {
      slideRef.current.style.transition = SPRING;
    }
  }, [animate]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't fire click if we were swiping
    const drag = dragRef.current;
    if (drag?.isSwiping) {
      e.preventDefault();
      return;
    }
    if (visualState !== 'idle') return;
    onClick();
  }, [visualState, onClick]);

  /* ── render ──────────────────────────────────────── */

  if (visualState === 'dismissed') return null;

  const isChange = (item.notificationType === 'issue-update' || item.notificationType === 'mr-note') &&
    item.bodyPreview.includes('\u2192');

  return (
    <div
      ref={rowRef}
      className="relative overflow-hidden"
      data-testid="notification-row"
      style={visualState === 'completing' ? {
        maxHeight: rowRef.current?.offsetHeight ?? 100,
        transition: COLLAPSE,
        overflow: 'hidden',
      } : undefined}
      onTransitionEnd={visualState === 'completing' ? () => {
        if (rowRef.current) {
          rowRef.current.style.maxHeight = '0px';
          rowRef.current.style.opacity = '0';
        }
      } : undefined}
    >
      {/* Right action: Mark Read (blue) — behind, left-aligned */}
      <div
        ref={rightBgRef}
        className="absolute inset-y-0 left-0 items-center bg-blue-500"
        style={{ display: 'none', width: ACTION_WIDTH }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); completeAction('read'); }}
          className="flex flex-col items-center justify-center gap-1 w-[80px] h-full text-white active:bg-blue-600"
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

      {/* Left action: Delete (red) — behind, right-aligned */}
      <div
        ref={leftBgRef}
        className="absolute inset-y-0 right-0 items-center justify-end bg-red-500"
        style={{ display: 'none', width: ACTION_WIDTH }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); completeAction('dismiss'); }}
          className="flex flex-col items-center justify-center gap-1 w-[80px] h-full text-white active:bg-red-600"
          data-testid="action-dismiss"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">Delete</span>
        </button>
      </div>

      {/* Slideable row content */}
      <div
        ref={slideRef}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' && visualState === 'idle') onClick(); }}
        onMouseDown={handleMouseDown}
        className={`group relative w-full text-left flex gap-2.5 px-3 py-2.5 density-compact:py-2 density-comfortable:py-3 cursor-pointer select-none ${
          isUnread
            ? 'bg-background hover:bg-muted/40'
            : 'bg-background hover:bg-muted/30'
        }`}
        style={{ transform: 'translateX(0px)', willChange: 'transform' }}
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
