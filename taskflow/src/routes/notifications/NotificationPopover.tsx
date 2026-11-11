/**
 * NotificationPopover — Ledger notification feed rendered inside TopBar's Popover (Phase 95, 261111-i2o).
 *
 * - ONE header row: "Notifications", Mark all read, and a macOS-style Clear all (✕ that expands into
 *   an inline "Clear all" confirmation). No read/source filters: the list always shows everything
 *   (261111-m0g UAT).
 * - Entries built by notification-view (time-bucket headers + cards), then stackEntries(): an issue /
 *   MR with 2+ cards is one stack (expand in place, "Show less" / "Clear"); rendered by
 *   NotificationList (virtualized, keyboard triage)
 * - Row click = mark read + navigate + close (D-13); no peek wiring
 * - Quick actions: Jira Reply (issue + focused composer), GitLab Reply / View pipeline (safe external
 *   URL), Review / Open MR (in-app MR page); no new backend APIs
 * - Fetch error with cached items shows StaleDataBanner; with no items shows ErrorState
 */

import { Bell, BellOff, CheckCheck, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { StaleDataBanner } from '../../components/ui/stale-data-banner';
import { useNow } from '../../hooks/useNow';
import { useNotificationsStore } from '../../stores/notifications.store';
import ClearAllButton from './ClearAllButton';
import NotificationList, { type NotificationListMotion } from './NotificationList';
import NotificationRow, { StackCard, StackHeader } from './NotificationRow';
import {
  NOTIF_CLEAR_ALL_MAX_DELAY_MS,
  NOTIF_CLEAR_ALL_STAGGER_MS,
  NOTIF_ENTER_MS,
  NOTIF_EXIT_MS,
  NOTIF_FAN_MS,
  NOTIF_FLASH_MS,
  NOTIF_STACK_STAGGER_MS,
  prefersReducedMotion,
} from './notification-motion';
import {
  buildEntries,
  type EventEntry,
  entityKey,
  entryIds,
  getEntityRef,
  getEntityTitle,
  type NotificationEntry,
  type StackEntry,
  type StackHeaderEntry,
  stackEntries,
  stackIds,
} from './notification-view';
import { useNotificationActions } from './useNotificationActions';

interface NotificationPopoverProps {
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
  onClose?: () => void;
  onOpenSettings?: () => void;
}

/** Empty/error states sit on glass: give them a card surface so they stay readable. */
const EMPTY_CARD = 'mx-2.5 mb-3 flex-none rounded-[14px] bg-card shadow-(--notif-sh-rest)';

export default function NotificationPopover({
  onIssueClick,
  onMRClick,
  onClose,
  onOpenSettings,
}: NotificationPopoverProps) {
  const now = useNow(60_000);
  const [dismissedError, setDismissedError] = useState<unknown>(null);
  /** Entity keys of expanded stacks (ephemeral UI state, never persisted). */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const items = useNotificationsStore((s) => s.items);
  const readIds = useNotificationsStore((s) => s.readIds);
  const permissionDenied = useNotificationsStore((s) => s.permissionDenied);
  const notificationSendError = useNotificationsStore((s) => s.notificationSendError);
  const fetchError = useNotificationsStore((s) => s.fetchError);
  const retryFetch = useNotificationsStore((s) => s.retryFetch);
  const markItemsUnread = useNotificationsStore((s) => s.markItemsUnread);
  const markItemsRead = useNotificationsStore((s) => s.markItemsRead);
  const removeItems = useNotificationsStore((s) => s.removeItems);
  const setPermissionDenied = useNotificationsStore((s) => s.setPermissionDenied);
  const setNotificationSendError = useNotificationsStore((s) => s.setNotificationSendError);

  const readSet = new Set(readIds);
  const flatEntries = buildEntries({
    items,
    readSet,
    source: 'all',
    unreadOnly: false,
    now,
  });
  const entries = stackEntries(flatEntries, expanded);
  /** Header subtitle counts CARDS (merged runs count once), the same unit as the bell badge. */
  const cardTotal = flatEntries.filter((e) => e.kind === 'event').length;
  const cardUnread = flatEntries.filter((e) => e.kind === 'event' && e.isUnread).length;

  // Forget expanded keys whose stack is gone (cleared / dropped below 2 cards), so a later
  // notification on the same issue does not reappear already expanded. Checked against the
  // UNFILTERED items (WR-04): switching Unread/All or the source must not collapse a stack that
  // still exists, only the visible subset of it.
  useEffect(() => {
    const all = buildEntries({
      items,
      readSet: new Set(readIds),
      source: 'all',
      unreadOnly: false,
      now,
    });
    const counts = new Map<string, number>();
    for (const e of all) {
      if (e.kind !== 'event') continue;
      const k = entityKey(e.item);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    setExpanded((prev) => {
      const next = new Set([...prev].filter((k) => (counts.get(k) ?? 0) >= 2));
      return next.size === prev.size ? prev : next;
    });
  }, [items, readIds, now]);

  // ── Motion lifecycle: ephemeral state only, never rebuilds the list ──
  // No row entrance on open or on filter switches: the panel slides + fades in as one piece
  // (TopBar / .notif-glass), and per-row entrances read as a top-to-bottom build (261111-m0g UAT).

  /** Item ids that arrived while open. Seeded on mount so initial items never count as arrivals. */
  const [entering, setEntering] = useState<ReadonlySet<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (knownIds.current === null) {
      knownIds.current = new Set(items.map((i) => i.id));
      return;
    }
    const known = knownIds.current;
    const fresh = items.map((i) => i.id).filter((id) => !known.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) known.add(id);
    setEntering((prev) => new Set([...prev, ...fresh]));
    setTimeout(() => {
      setEntering((prev) => {
        const next = new Set(prev);
        for (const id of fresh) next.delete(id);
        return next;
      });
    }, NOTIF_ENTER_MS);
  }, [items]);

  /** Entry id -> exit delay. Items are removed from the store only after the exit animation. */
  const [leaving, setLeaving] = useState<ReadonlyMap<string, number>>(new Map());
  const [flashing, setFlashing] = useState<ReadonlySet<string>>(new Set());
  const [justExpanded, setJustExpanded] = useState<string | null>(null);
  /** Exit timers still pending -> the store ids they will remove. */
  const exitTimers = useRef(new Map<ReturnType<typeof setTimeout>, string[]>());

  // Closing the panel mid-exit must not lose the clear: apply pending removals right away.
  useEffect(
    () => () => {
      for (const [timer, ids] of exitTimers.current) {
        clearTimeout(timer);
        removeItems(ids);
      }
      exitTimers.current.clear();
    },
    [removeItems],
  );

  function leave(targets: { id: string; delay: number }[], storeIds: string[]) {
    if (prefersReducedMotion()) {
      removeItems(storeIds);
      return;
    }
    // Already on its way out (double click / key repeat).
    if (targets.every((t) => leaving.has(t.id))) return;
    setLeaving((prev) => {
      const next = new Map(prev);
      for (const t of targets) next.set(t.id, t.delay);
      return next;
    });
    const maxDelay = Math.max(0, ...targets.map((t) => t.delay));
    const timer = setTimeout(() => {
      exitTimers.current.delete(timer);
      removeItems(storeIds);
      setLeaving((prev) => {
        const next = new Map(prev);
        for (const t of targets) next.delete(t.id);
        return next;
      });
    }, NOTIF_EXIT_MS + maxDelay);
    exitTimers.current.set(timer, storeIds);
  }

  function toggleStack(entity: string) {
    const expanding = !expanded.has(entity);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) next.delete(entity);
      else next.add(entity);
      return next;
    });
    if (expanding) {
      setJustExpanded(entity);
      setTimeout(() => setJustExpanded((cur) => (cur === entity ? null : cur)), NOTIF_FAN_MS);
    }
  }

  const unreadIds = items.filter((i) => !readSet.has(i.id)).map((i) => i.id);

  const idsOf = (entry: EventEntry | StackEntry) =>
    entry.kind === 'stack' ? stackIds(entry) : entryIds(entry);

  const { openEvent, getOpenInBrowser, getQuick } = useNotificationActions({
    onIssueClick,
    onMRClick,
    onClose,
  });

  function toggleRead(entry: EventEntry | StackEntry) {
    setFlashing((prev) => new Set(prev).add(entry.id));
    setTimeout(() => {
      setFlashing((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }, NOTIF_FLASH_MS);
    if (entry.isUnread) markItemsRead(idsOf(entry));
    else markItemsUnread(idsOf(entry));
  }

  function done(entry: EventEntry | StackEntry) {
    leave([{ id: entry.id, delay: 0 }], idsOf(entry));
  }

  /** Stack "Clear": the header and every member slide out, staggered. */
  function clearStack(entry: StackHeaderEntry) {
    leave(
      [
        { id: entry.id, delay: 0 },
        ...entry.cards.map((c, i) => ({ id: c.id, delay: i * NOTIF_STACK_STAGGER_MS })),
      ],
      stackIds(entry),
    );
  }

  /** Clear all: every visible card / stack slides out (short stagger, capped), then everything goes. */
  function clearAll() {
    const targets = entries
      .filter((e) => e.kind !== 'header')
      .map((e, i) => ({
        id: e.id,
        delay: Math.min(i * NOTIF_CLEAR_ALL_STAGGER_MS, NOTIF_CLEAR_ALL_MAX_DELAY_MS),
      }));
    leave(
      targets,
      items.map((i) => i.id),
    );
  }

  function renderEntry(entry: NotificationEntry) {
    if (entry.kind === 'header') {
      return (
        <div className="flex h-7 items-end px-1 pb-1 text-xs font-semibold text-foreground/70 density-compact:h-6">
          {entry.label}
        </div>
      );
    }
    if (entry.kind === 'stack-header') {
      const top = entry.cards[0].item;
      return (
        <StackHeader
          entityRef={getEntityRef(top) ?? ''}
          title={getEntityTitle(top)}
          onCollapse={() => toggleStack(entry.entity)}
          onClear={() => clearStack(entry)}
        />
      );
    }
    if (entry.kind === 'stack') {
      const top = entry.cards[0];
      return (
        <StackCard>
          <NotificationRow
            item={top.item}
            items={top.items}
            isUnread={entry.isUnread}
            now={now}
            stackMore={entry.more}
            onOpen={() => toggleStack(entry.entity)}
            onToggleRead={() => toggleRead(entry)}
            onDone={() => done(entry)}
            onOpenInBrowser={getOpenInBrowser(top)}
            quick={getQuick(top)}
          />
        </StackCard>
      );
    }
    const ev: EventEntry = entry;
    return (
      <NotificationRow
        item={ev.item}
        items={ev.items}
        isUnread={ev.isUnread}
        now={now}
        onOpen={() => openEvent(ev)}
        onToggleRead={() => toggleRead(ev)}
        onDone={() => done(ev)}
        onOpenInBrowser={getOpenInBrowser(ev)}
        quick={getQuick(ev)}
      />
    );
  }

  const settingsAction = onOpenSettings ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        onOpenSettings();
        onClose?.();
      }}
    >
      Notification settings
    </Button>
  ) : undefined;

  const motion: NotificationListMotion = { entering, leaving, flashing, justExpanded };

  function renderBody() {
    if (items.length === 0 && fetchError) {
      return (
        <div className="mx-2.5 mb-3 flex-none rounded-[14px] bg-card p-2 shadow-(--notif-sh-rest)">
          <ErrorState
            error={fetchError}
            onRetry={retryFetch ?? undefined}
            viewName="notifications"
          />
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          compact
          className={EMPTY_CARD}
          icon={Bell}
          title="No notifications yet"
          subtitle="Activity on your Jira issues and GitLab merge requests will show up here."
          action={settingsAction}
        />
      );
    }
    return (
      <NotificationList
        entries={entries}
        renderEntry={renderEntry}
        onToggleRead={toggleRead}
        onDone={done}
        onToggleStack={toggleStack}
        motion={motion}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header: title + count subtitle, Mark all read, Clear all (inline macOS-style confirmation) */}
      <div className="flex flex-none items-center gap-2 px-4 pt-3.5 pb-1">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] leading-tight font-semibold tracking-[-0.01em]">
            Notifications
          </h2>
          {cardTotal > 0 ? (
            <p
              data-header-subtitle
              className="truncate text-[11px] text-muted-foreground tabular-nums"
            >
              {cardUnread > 0 ? `${cardUnread} unread` : 'All caught up'} · {cardTotal} total
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="flex-none"
          aria-label="Mark all read"
          title="Mark all read"
          disabled={unreadIds.length === 0}
          onClick={() => markItemsRead(unreadIds)}
        >
          <CheckCheck />
        </Button>
        <ClearAllButton onConfirm={clearAll} disabled={items.length === 0} />
      </div>

      {/* Permission-denied banner — same pattern as StaleDataBanner (icon, muted text, ghost X) */}
      {permissionDenied && (
        <div className="m-2 flex-none">
          <PopoverBanner
            icon={<BellOff className="size-4 shrink-0 text-muted-foreground" />}
            onDismiss={() => setPermissionDenied(false)}
          >
            System notifications are blocked — enable them in System Settings.
          </PopoverBanner>
        </div>
      )}

      {/* Notification send error banner (e.g. dev mode on macOS) */}
      {notificationSendError && !permissionDenied && (
        <div className="m-2 flex-none">
          <PopoverBanner
            icon={<TriangleAlert className="size-4 shrink-0 text-muted-foreground" />}
            onDismiss={() => setNotificationSendError(false)}
          >
            Desktop notifications failed to send (expected in dev mode — macOS needs a signed app).
          </PopoverBanner>
        </div>
      )}

      {/* Stale-data banner: fetch failed but cached items are shown */}
      {fetchError && items.length > 0 && fetchError !== dismissedError && (
        <div className="m-2 flex-none">
          <StaleDataBanner
            onRetry={() => retryFetch?.()}
            onDismiss={() => setDismissedError(fetchError)}
          />
        </div>
      )}

      {renderBody()}
    </div>
  );
}

/** Popover-local info banner; mirrors the shared StaleDataBanner box so all banners match. */
function PopoverBanner({
  icon,
  children,
  onDismiss,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm"
    >
      {icon}
      <span className="flex-1 text-muted-foreground">{children}</span>
      <Button variant="ghost" size="sm" aria-label="Dismiss" onClick={onDismiss}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
