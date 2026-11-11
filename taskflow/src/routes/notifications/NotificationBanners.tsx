/**
 * NotificationBanners — in-app banners for genuinely new notifications (261111-m0g).
 *
 * Portaled to document.body (the app's <main> is `isolate`, a fixed overlay inside it would sit
 * under the sidebar border). Max 3, newest on top, top-right under the TopBar. Hover / focus
 * pauses the timer; the auto-dismiss duration is the "Banner duration" setting. Never shown while
 * the notification panel is open: the item enters the list there instead.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNow } from '../../hooks/useNow';
import { cn } from '../../lib/utils';
import { useNotificationBanners } from '../../stores/notification-banners.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import { useSettingsStore } from '../../stores/settings.store';
import NotificationRow from './NotificationRow';
import type { EventEntry } from './notification-view';
import { useNotificationActions } from './useNotificationActions';

/** Resume never leaves less than this on the clock, so a banner is not yanked right after hover. */
const MIN_RESUME_MS = 800;
/** Matches the notif-banner-out animation. */
const BANNER_EXIT_MS = 300;

interface NotificationBannersProps {
  /** The notification panel is open: no banners, and the queue is dropped. */
  open: boolean;
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
}

export default function NotificationBanners({
  open,
  onIssueClick,
  onMRClick,
}: NotificationBannersProps) {
  const ids = useNotificationBanners((s) => s.ids);
  const clear = useNotificationBanners((s) => s.clear);
  const setSuppressed = useNotificationBanners((s) => s.setSuppressed);

  useEffect(() => {
    setSuppressed(open);
    if (open) clear();
    // Never leave the global flag stuck if this unmounts while the panel is open.
    return () => setSuppressed(false);
  }, [open, clear, setSuppressed]);

  if (open || ids.length === 0) return null;

  return createPortal(
    <section
      aria-label="New notifications"
      aria-live="polite"
      data-notif-motion
      className="pointer-events-none fixed top-[60px] right-4 z-[70] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {ids.map((id) => (
        <Banner key={id} id={id} onIssueClick={onIssueClick} onMRClick={onMRClick} />
      ))}
    </section>,
    document.body,
  );
}

function Banner({
  id,
  onIssueClick,
  onMRClick,
}: {
  id: string;
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
}) {
  const item = useNotificationsStore((s) => s.items.find((i) => i.id === id));
  const isUnread = useNotificationsStore((s) => !s.readIds.includes(id));
  const durationSecs = useSettingsStore((s) => s.notifBannerDurationSecs);
  const dismiss = useNotificationBanners((s) => s.dismiss);
  const now = useNow(60_000);
  const [leaving, setLeaving] = useState(false);
  const { openEvent, getQuick } = useNotificationActions({ onIssueClick, onMRClick });

  const remaining = useRef(durationSecs * 1000);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hover and focus each hold the pause; the clock only resumes when neither does.
  const hovered = useRef(false);
  const focused = useRef(false);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = (ms: number) => {
    stop();
    startedAt.current = Date.now();
    timer.current = setTimeout(() => setLeaving(true), ms);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: start/stop only touch refs
  useEffect(() => {
    remaining.current = durationSecs * 1000;
    if (!hovered.current && !focused.current) start(remaining.current);
    return stop;
  }, [durationSecs]);

  // The item vanished (cleared from the panel / store): drop the banner.
  useEffect(() => {
    if (!item) dismiss(id);
  }, [item, id, dismiss]);

  // Slide out, then remove.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => dismiss(id), BANNER_EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving, id, dismiss]);

  if (!item) return null;

  const entry: EventEntry = {
    kind: 'event',
    id: `event:${id}`,
    item,
    items: [item],
    isUnread,
  };
  const quick = getQuick(entry);
  const leave = () => setLeaving(true);

  const pause = () => {
    if (!timer.current) return;
    remaining.current -= Date.now() - startedAt.current;
    stop();
  };
  const resume = () => {
    if (leaving || timer.current || hovered.current || focused.current) return;
    start(Math.max(MIN_RESUME_MS, remaining.current));
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover / focus only pause the timer; the card inside holds the real buttons
    <div
      data-notif-banner
      data-leaving={leaving ? 'true' : undefined}
      onMouseEnter={() => {
        hovered.current = true;
        pause();
      }}
      onMouseLeave={() => {
        hovered.current = false;
        resume();
      }}
      onFocus={() => {
        focused.current = true;
        pause();
      }}
      onBlur={() => {
        focused.current = false;
        resume();
      }}
      className={cn(
        '@container pointer-events-auto relative animate-[notif-banner-in_.5s_var(--spring)_both]',
        leaving && 'animate-[notif-banner-out_.3s_cubic-bezier(.4,0,1,1)_forwards]',
      )}
    >
      <NotificationRow
        variant="banner"
        item={item}
        items={[item]}
        isUnread={isUnread}
        now={now}
        onOpen={() => {
          openEvent(entry);
          leave();
        }}
        onToggleRead={() => {}}
        onDone={leave}
        quick={
          quick
            ? {
                label: quick.label,
                onClick: () => {
                  quick.onClick();
                  leave();
                },
              }
            : undefined
        }
      />
    </div>
  );
}
