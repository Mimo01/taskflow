/**
 * NotificationPopover — Ledger notification feed rendered inside TopBar's Popover (Phase 95, 261111-i2o).
 *
 * - ONE header row: "Notifications", light segmented Unread | All, "All sources" dropdown (with
 *   per-source unread counts), Mark all read icon button, overflow (Clear read, Notification settings)
 * - Entries built by notification-view (time-bucket headers + cards), then stackEntries(): an issue /
 *   MR with 2+ cards is one stack (expand in place, "Show less" / "Clear"); rendered by
 *   NotificationList (virtualized, keyboard triage)
 * - Row click = mark read + navigate + close (D-13); no peek wiring
 * - Quick actions: Jira Reply (issue + focused composer), GitLab Reply / View pipeline (safe external
 *   URL), Review / Open MR (in-app MR page); no new backend APIs
 * - Fetch error with cached items shows StaleDataBanner; with no items shows ErrorState
 */

import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronDown,
  MoreHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { StaleDataBanner } from '../../components/ui/stale-data-banner';
import { useNow } from '../../hooks/useNow';
import { openExternal } from '../../lib/openExternal';
import { cn } from '../../lib/utils';
import { useComposerFocus } from '../../stores/composer-focus.store';
import type { NotificationItem } from '../../stores/notifications.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationList from './NotificationList';
import NotificationRow, { StackCard, StackHeader } from './NotificationRow';
import {
  buildEntries,
  countUnreadCards,
  describeEntryParts,
  type EventEntry,
  entryIds,
  filterItems,
  getEntityRef,
  getEntityTitle,
  getJiraKey,
  isSafeHttpUrl,
  type NotificationEntry,
  type QuickAction,
  quickActionFor,
  type SourceFilter,
  type StackEntry,
  stackEntries,
  stackIds,
} from './notification-view';

interface NotificationPopoverProps {
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
  onClose?: () => void;
  onOpenSettings?: () => void;
}

const SOURCE_TABS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'All sources' },
  { key: 'jira', label: 'Jira' },
  { key: 'gitlab', label: 'GitLab' },
];

export default function NotificationPopover({
  onIssueClick,
  onMRClick,
  onClose,
  onOpenSettings,
}: NotificationPopoverProps) {
  const now = useNow(60_000);
  const [activeTab, setActiveTab] = useState<SourceFilter>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [dismissedError, setDismissedError] = useState<unknown>(null);
  /** Entity keys of expanded stacks (ephemeral UI state, never persisted). */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const requestComposerFocus = useComposerFocus((s) => s.requestComposerFocus);

  const items = useNotificationsStore((s) => s.items);
  const readIds = useNotificationsStore((s) => s.readIds);
  const permissionDenied = useNotificationsStore((s) => s.permissionDenied);
  const notificationSendError = useNotificationsStore((s) => s.notificationSendError);
  const fetchError = useNotificationsStore((s) => s.fetchError);
  const retryFetch = useNotificationsStore((s) => s.retryFetch);
  const markItemsUnread = useNotificationsStore((s) => s.markItemsUnread);
  const markItemsRead = useNotificationsStore((s) => s.markItemsRead);
  const removeItems = useNotificationsStore((s) => s.removeItems);
  const clearRead = useNotificationsStore((s) => s.clearRead);
  const setPermissionDenied = useNotificationsStore((s) => s.setPermissionDenied);
  const setNotificationSendError = useNotificationsStore((s) => s.setNotificationSendError);

  const readSet = new Set(readIds);
  const entries = stackEntries(
    buildEntries({
      items,
      readSet,
      source: activeTab,
      unreadOnly,
      now,
    }),
    expanded,
  );

  // Forget expanded keys whose stack is gone (cleared / dropped below 2 cards), so a later
  // notification on the same issue does not reappear already expanded.
  useEffect(() => {
    const live = new Set(
      entries.flatMap((e) => (e.kind === 'stack' || e.kind === 'stack-header' ? [e.entity] : [])),
    );
    setExpanded((prev) => {
      const next = new Set([...prev].filter((k) => live.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [entries]);

  function toggleStack(entity: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) next.delete(entity);
      else next.add(entity);
      return next;
    });
  }

  const scopedItems = filterItems(items, readSet, activeTab, false);
  const scopedUnreadIds = scopedItems.filter((i) => !readSet.has(i.id)).map((i) => i.id);
  const hasScopedRead = scopedItems.some((i) => readSet.has(i.id));

  /** Unread CARDS per tab (merged runs count once) so chips match the list and the bell. */
  function unreadCount(source: SourceFilter): number {
    return countUnreadCards(items, readSet, source, now);
  }

  function navigateTo(item: NotificationItem) {
    const key = getJiraKey(item);
    if (key && onIssueClick) {
      onIssueClick(key);
      onClose?.();
      return;
    }
    if (item.source === 'gitlab' && item.mrProjectId && item.mrIid && onMRClick) {
      onMRClick(`${item.mrProjectId}/${item.mrIid}`);
      onClose?.();
    }
    // No navigable target: stays open, already marked read.
  }

  const idsOf = (entry: EventEntry | StackEntry) =>
    entry.kind === 'stack' ? stackIds(entry) : entryIds(entry);

  function openEvent(entry: EventEntry) {
    markItemsRead(idsOf(entry));
    navigateTo(entry.item);
  }

  function toggleRead(entry: EventEntry | StackEntry) {
    if (entry.isUnread) markItemsRead(idsOf(entry));
    else markItemsUnread(idsOf(entry));
  }

  function done(entry: EventEntry | StackEntry) {
    removeItems(idsOf(entry));
  }

  function getOpenInBrowser(entry: EventEntry): (() => void) | undefined {
    const url = entry.item.url;
    if (!url || !isSafeHttpUrl(url)) return undefined;
    return () => {
      openExternal(url);
      markItemsRead(entryIds(entry));
    };
  }

  /** The card's single quick action, wired to what the app can already do. */
  function getQuick(entry: EventEntry): { label: string; onClick: () => void } | undefined {
    const item = entry.item;
    const action: QuickAction | null = quickActionFor(item, describeEntryParts(entry.items));
    if (!action) return undefined;
    const run = () => {
      markItemsRead(entryIds(entry));
      switch (action.kind) {
        case 'reply-jira': {
          const key = getJiraKey(item);
          if (!key) return;
          requestComposerFocus(key);
          onIssueClick?.(key);
          onClose?.();
          return;
        }
        case 'reply-gitlab':
        case 'pipeline':
          if (item.url && isSafeHttpUrl(item.url)) openExternal(item.url);
          return;
        case 'review':
        case 'open-mr':
          if (item.mrProjectId != null && item.mrIid != null) {
            onMRClick?.(`${item.mrProjectId}/${item.mrIid}`);
            onClose?.();
          }
          return;
      }
    };
    return { label: action.label, onClick: run };
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
          onClear={() => removeItems(stackIds(entry))}
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

  function renderBody() {
    if (items.length === 0 && fetchError) {
      return (
        <div className="p-2">
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
          icon={Bell}
          title="No notifications yet"
          subtitle="Activity on your Jira issues and GitLab merge requests will show up here."
          action={settingsAction}
        />
      );
    }
    if (entries.length === 0 && unreadOnly) {
      return (
        <EmptyState
          compact
          icon={BellOff}
          title="All caught up"
          subtitle="You have no unread notifications."
        />
      );
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          compact
          icon={BellOff}
          title={`Nothing from ${activeTab === 'jira' ? 'Jira' : 'GitLab'}`}
          subtitle="No notifications from this source."
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
      />
    );
  }

  return (
    <div>
      {/* One header row: title, Unread | All, source filter, Mark all read, overflow */}
      <div className="flex h-11 items-center gap-2 px-3">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">Notifications</h2>
        <fieldset className="m-0 inline-flex flex-none rounded-lg border-0 bg-muted p-0.5">
          <legend className="sr-only">Show</legend>
          {(
            [
              { value: true, label: 'Unread' },
              { value: false, label: 'All' },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={unreadOnly === value}
              onClick={() => setUnreadOnly(value)}
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                unreadOnly === value
                  ? 'bg-background text-foreground ring-1 ring-foreground/10'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                className="flex-none"
                aria-label="Filter by source"
              />
            }
          >
            {SOURCE_TABS.find((tab) => tab.key === activeTab)?.label}
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as SourceFilter)}
            >
              {SOURCE_TABS.map((tab) => {
                const count = unreadCount(tab.key);
                return (
                  <DropdownMenuRadioItem key={tab.key} value={tab.key}>
                    {tab.label}
                    {count > 0 && (
                      <span className="ml-1 rounded bg-muted px-1 text-[11px] text-muted-foreground tabular-nums">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-xs"
          className="flex-none"
          aria-label="Mark all read"
          title="Mark all read"
          disabled={scopedUnreadIds.length === 0}
          onClick={() => markItemsRead(scopedUnreadIds)}
        >
          <CheckCheck />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="flex-none"
                aria-label="More actions"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              title="Remove all read notifications"
              disabled={!hasScopedRead}
              onClick={() => clearRead(activeTab === 'all' ? undefined : activeTab)}
            >
              Clear read
            </DropdownMenuItem>
            {onOpenSettings && (
              <DropdownMenuItem
                onClick={() => {
                  onOpenSettings();
                  onClose?.();
                }}
              >
                Notification settings
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Permission-denied banner — same pattern as StaleDataBanner (icon, muted text, ghost X) */}
      {permissionDenied && (
        <div className="m-2">
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
        <div className="m-2">
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
        <div className="m-2">
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
