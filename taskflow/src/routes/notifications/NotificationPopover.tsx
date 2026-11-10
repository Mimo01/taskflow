/**
 * NotificationPopover — flat two-line notification feed rendered inside TopBar's Popover (Phase 95).
 *
 * - Header: "Notifications", ghost "Mark all read", overflow (Clear read, Notification settings)
 * - Filter bar: segmented Unread | All + source tabs with neutral unread chips
 * - Entries built by notification-view (time-bucket headers + one entry per notification), rendered by
 *   NotificationList (virtualized, keyboard triage)
 * - Row click = mark read + navigate + close (D-13); no peek wiring
 * - Fetch error with cached items shows StaleDataBanner; with no items shows ErrorState
 */

import { Bell, BellOff, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { StaleDataBanner } from '../../components/ui/stale-data-banner';
import { useNow } from '../../hooks/useNow';
import { openExternal } from '../../lib/openExternal';
import { cn } from '../../lib/utils';
import type { NotificationItem } from '../../stores/notifications.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationList from './NotificationList';
import NotificationRow from './NotificationRow';
import {
  buildEntries,
  type EventEntry,
  filterItems,
  getJiraKey,
  isSafeHttpUrl,
  type NotificationEntry,
  type SourceFilter,
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

  const items = useNotificationsStore((s) => s.items);
  const readIds = useNotificationsStore((s) => s.readIds);
  const permissionDenied = useNotificationsStore((s) => s.permissionDenied);
  const notificationSendError = useNotificationsStore((s) => s.notificationSendError);
  const fetchError = useNotificationsStore((s) => s.fetchError);
  const retryFetch = useNotificationsStore((s) => s.retryFetch);
  const markAsRead = useNotificationsStore((s) => s.markAsRead);
  const markAsUnread = useNotificationsStore((s) => s.markAsUnread);
  const markItemsRead = useNotificationsStore((s) => s.markItemsRead);
  const removeItem = useNotificationsStore((s) => s.removeItem);
  const clearRead = useNotificationsStore((s) => s.clearRead);
  const setPermissionDenied = useNotificationsStore((s) => s.setPermissionDenied);
  const setNotificationSendError = useNotificationsStore((s) => s.setNotificationSendError);

  const readSet = new Set(readIds);
  const entries = buildEntries({
    items,
    readSet,
    source: activeTab,
    unreadOnly,
    now,
  });

  const scopedItems = filterItems(items, readSet, activeTab, false);
  const scopedUnreadIds = scopedItems.filter((i) => !readSet.has(i.id)).map((i) => i.id);
  const hasScopedRead = scopedItems.some((i) => readSet.has(i.id));

  function unreadCount(source: SourceFilter): number {
    return items.filter((i) => (source === 'all' || i.source === source) && !readSet.has(i.id))
      .length;
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

  function openEvent(item: NotificationItem) {
    markAsRead(item.id);
    navigateTo(item);
  }

  function toggleRead(entry: EventEntry) {
    if (entry.isUnread) markAsRead(entry.item.id);
    else markAsUnread(entry.item.id);
  }

  function done(entry: EventEntry) {
    removeItem(entry.item.id);
  }

  function getOpenInBrowser(item: NotificationItem): (() => void) | undefined {
    const url = item.url;
    if (!url || !isSafeHttpUrl(url)) return undefined;
    return () => {
      openExternal(url);
      markAsRead(item.id);
    };
  }

  function renderEntry(entry: NotificationEntry) {
    if (entry.kind === 'header') {
      return (
        <div className="flex h-7 items-center px-4 text-[11px] font-medium text-muted-foreground density-compact:h-6">
          {entry.label}
        </div>
      );
    }
    const ev: EventEntry = entry;
    return (
      <NotificationRow
        item={ev.item}
        isUnread={ev.isUnread}
        now={now}
        onOpen={() => openEvent(ev.item)}
        onToggleRead={() => toggleRead(ev)}
        onDone={() => done(ev)}
        onOpenInBrowser={getOpenInBrowser(ev.item)}
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
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex h-10 items-center justify-between px-4">
        <h2 className="text-sm font-medium">Notifications</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={scopedUnreadIds.length === 0}
            onClick={() => markItemsRead(scopedUnreadIds)}
          >
            Mark all read
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="size-7" aria-label="More actions" />
              }
            >
              <MoreHorizontal className="size-4" />
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
      </div>

      {/* Filter bar */}
      <div className="flex h-9 items-center justify-between gap-2 border-b px-4">
        <fieldset className="m-0 inline-flex rounded-lg border-0 bg-muted p-0.5">
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
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <div className="flex h-full items-stretch">
          {SOURCE_TABS.map((tab) => {
            const count = unreadCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex shrink-0 items-center whitespace-nowrap px-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 rounded bg-muted px-1 text-[11px] text-muted-foreground tabular-nums">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Permission-denied banner */}
      {permissionDenied && (
        <div className="m-2">
          <Alert>
            <AlertDescription>
              System notifications are blocked. Enable them in System Settings to get alerts outside
              the app.
            </AlertDescription>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setPermissionDenied(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </Alert>
        </div>
      )}

      {/* Notification send error banner (e.g. dev mode on macOS) */}
      {notificationSendError && !permissionDenied && (
        <div className="m-2">
          <Alert>
            <AlertDescription>
              Desktop notifications failed to send. If running in dev mode, this is expected — macOS
              requires a signed app bundle. Try a production build to verify.
            </AlertDescription>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setNotificationSendError(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </Alert>
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
