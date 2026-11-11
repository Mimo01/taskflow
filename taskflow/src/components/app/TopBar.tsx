/**
 * TopBar — persistent top bar with search icon (opens palette), clock icon
 * (recent items popover), and notification bell (tabbed Jira/GitLab popover).
 *
 * Pure UI component: renders badge from total unread count, delegates all state to AppLayout.
 * Polling is performed by useNotificationPolling hook called from AppLayout in main.tsx
 * (requires QueryClientProvider — separated so TopBar tests work without a QueryClient wrapper).
 *
 * CRITICAL: TopBar must NOT use useQuery directly.
 */

import { Bell, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import NotificationBanners from '../../routes/notifications/NotificationBanners';
import NotificationPopover from '../../routes/notifications/NotificationPopover';
import { createSwipeRightTracker } from '../../routes/notifications/notification-motion';
import { useUnreadCardCount } from '../../routes/notifications/useUnreadCardCount';
import { useNotificationsStore, useUnreadCount } from '../../stores/notifications.store';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import RecentItemsPopover from './RecentItemsPopover';

/** Panel inset from the window's right edge; .notif-glass extends 11px past it (to 1px of the edge). */
const NOTIF_RIGHT_INSET_PX = 12;

interface TopBarProps {
  /**
   * Called with the Jira issue key when a Jira result in search or
   * notifications is clicked. TopBar deliberately exposes NO peek/open-in-
   * sidebar callback: notification and recent-item issue clicks always
   * navigate to the full issue page (260605-hb4).
   */
  onIssueClick?: (issueKey: string) => void;
  /** Called with "projectId/iid" when a GitLab MR is clicked from recent items. */
  onMRClick?: (projectIdAndIid: string) => void;
  /** Whether the command palette is currently open (reserved for future visual feedback). */
  paletteOpen: boolean;
  /** Callback to open the command palette. */
  onPaletteOpen: () => void;
  /** Controlled open state for the notification popover. */
  notifPopoverOpen: boolean;
  /** Callback when notification popover open state changes. */
  onNotifPopoverChange: (open: boolean) => void;
  /** Opens app settings; surfaced as "Notification settings" in the notification popover. */
  onOpenSettings?: () => void;
}

export default function TopBar({
  onIssueClick,
  onMRClick,
  onPaletteOpen,
  notifPopoverOpen,
  onNotifPopoverChange,
  onOpenSettings,
}: TopBarProps) {
  // Badge shows unread CARDS (matches the list); the pulse keys off raw item arrivals so a new
  // comment folded into an existing card still rings the bell.
  const unreadCount = useUnreadCardCount();
  const rawUnread = useUnreadCount();
  const prevCountRef = useRef(rawUnread);
  const [bellPulse, setBellPulse] = useState(false);

  // Rehydrating persisted notifications on launch (0 -> N) is not an arrival: when hydration
  // finishes, move the baseline to the hydrated count so the bell does not ring.
  useEffect(
    () =>
      useNotificationsStore.persist.onFinishHydration((s) => {
        prevCountRef.current = s._unreadCount;
      }),
    [],
  );

  // Trigger pulse animation when unread count increases (new notifications arrived)
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = rawUnread;
    if (rawUnread <= prev || !useNotificationsStore.persist.hasHydrated()) return;
    setBellPulse(true);
    const timer = setTimeout(() => setBellPulse(false), 2000);
    // Any later count change (including a drop) cancels the timer, so stop the pulse here too.
    return () => {
      clearTimeout(timer);
      setBellPulse(false);
    };
  }, [rawUnread]);

  // Clear the pulse once, on the closed -> open transition. Arrivals while the panel is open must
  // still ring the bell, so this must not re-run on every count change.
  const prevOpenRef = useRef(false);
  // The panel "drops from" the lowest bar: the bottom of the pinned-issues strip when it is
  // showing, else the top bar's bottom line — so it never covers the pinned tabs (261111-m0g UAT).
  // Horizontally it is a sheet attached to the window's right edge (align="end").
  const headerRef = useRef<HTMLElement>(null);
  const notifPopupRef = useRef<HTMLDivElement>(null);
  /** Top edge of the panel: strictly below the lowest bar's divider (whole pixel). */
  const panelTop = () => {
    const bar = headerRef.current?.getBoundingClientRect();
    const strip = document.querySelector('[data-pinned-tab-strip]')?.getBoundingClientRect();
    return Math.ceil(Math.max(bar?.bottom ?? 0, strip?.bottom ?? 0));
  };
  const panelAnchor = {
    getBoundingClientRect: () => {
      const top = panelTop();
      // Sheet attached to the right edge: panel 12px in; the frost runs to the edge (index.css).
      const left = window.innerWidth - NOTIF_RIGHT_INSET_PX;
      return {
        x: left,
        y: top,
        left,
        top,
        right: left,
        bottom: top,
        width: 0,
        height: 0,
      } as DOMRect;
    },
    // Getter: read the ref lazily (when Floating UI asks), never during render.
    get contextElement() {
      return headerRef.current ?? undefined;
    },
  };
  // Explicit height cap from the real space below the panel's top, leaving room for the frost's
  // 14px bottom overhang + margin. If the panel were taller than that, the positioner would shift
  // it UP over the bars' divider (the "sidebar too high" bug) — collision shifting is also off.
  const [panelMaxH, setPanelMaxH] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!notifPopoverOpen) return;
    const measure = () => setPanelMaxH(Math.max(200, window.innerHeight - panelTop() - 28));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [notifPopoverOpen]);
  // Two-finger swipe right anywhere in the window closes the open panel, sliding it out to the
  // right (macOS NC). Window-level so it works wherever the pointer is, not only over the panel.
  const [trackSwipe] = useState(createSwipeRightTracker);
  const [swipeClosing, setSwipeClosing] = useState(false);
  useEffect(() => {
    if (!notifPopoverOpen) return;
    const onWheel = (e: WheelEvent) => {
      if (!trackSwipe(e)) return;
      setSwipeClosing(true);
      onNotifPopoverChange(false);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [notifPopoverOpen, trackSwipe, onNotifPopoverChange]);
  useEffect(() => {
    if (notifPopoverOpen && !prevOpenRef.current) {
      setSwipeClosing(false);
      setBellPulse(false);
      prevCountRef.current = rawUnread;
    }
    prevOpenRef.current = notifPopoverOpen;
  }, [notifPopoverOpen, rawUnread]);

  return (
    <header ref={headerRef} className="h-12 border-b flex items-center px-4 flex-shrink-0 gap-2">
      {/* Spacer — branding moved to Sidebar */}
      <div className="mr-auto" />

      {/* Search trigger — opens command palette via parent callback */}
      <button
        type="button"
        onClick={onPaletteOpen}
        aria-label="Search"
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Recent items popover — clock icon */}
      <RecentItemsPopover onIssueClick={onIssueClick} onMRClick={onMRClick} />

      {/* Notification popover — single bell with tabbed source filter */}
      <Popover open={notifPopoverOpen} onOpenChange={onNotifPopoverChange}>
        <PopoverTrigger
          className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <Bell
            className={`w-5 h-5 transition-transform ${bellPulse ? 'animate-bell-ring' : ''}`}
          />
          {unreadCount > 0 && (
            <span
              className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5 ${bellPulse ? 'animate-[notif-badge-pop_600ms_var(--spring)]' : ''}`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={0}
          anchor={panelAnchor}
          ref={notifPopupRef}
          // Focus the popup itself on open: Base UI focuses the first tabbable WITHOUT preventScroll,
          // and mid slide-in the panel overhangs the right edge, so the browser scrolled the whole
          // page sideways to reveal the button (page stayed shifted while open). Popup focus uses
          // preventScroll; Tab still reaches the buttons and cards (261111-m0g UAT).
          initialFocus={() => notifPopupRef.current}
          collisionAvoidance={{ side: 'none', align: 'none', fallbackAxisSide: 'none' }}
          style={panelMaxH ? { maxHeight: panelMaxH } : undefined}
          // The .notif-glass blur layer overhangs the panel by 14px on every side. Keep the panel
          // >= 16px from each viewport edge (end-aligned to the bell = 16px from the right; height and
          // width capped) or the overhang makes the document scrollable and WKWebView flickers the whole
          // page as scrollbars toggle on every layout change.
          data-notif-motion
          data-swipe-closing={swipeClosing ? 'true' : undefined}
          // Popup only slides; .notif-glass fades the blur + content (see index.css). Its opacity stays 1.
          className={`notif-glass relative z-0 flex max-h-[calc(100vh-132px)] w-[31rem] max-w-[calc(100vw-3rem)] flex-col rounded-none border-0 bg-transparent p-0 shadow-none ring-0 opacity-100 data-[starting-style]:opacity-100 data-[ending-style]:opacity-100 transition-[translate] duration-300 ease-(--ease-out) data-[starting-style]:translate-x-12 data-[ending-style]:duration-[180ms] data-[ending-style]:ease-in ${swipeClosing ? 'data-[ending-style]:translate-x-16' : 'data-[ending-style]:translate-x-6'}`}
        >
          <NotificationPopover
            onIssueClick={onIssueClick}
            onMRClick={onMRClick}
            onOpenSettings={onOpenSettings}
            onClose={() => onNotifPopoverChange(false)}
          />
        </PopoverContent>
      </Popover>

      {/* In-app banners for new notifications (portaled; suppressed while the panel is open) */}
      <NotificationBanners
        open={notifPopoverOpen}
        onIssueClick={onIssueClick}
        onMRClick={onMRClick}
      />
    </header>
  );
}
