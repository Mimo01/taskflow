/**
 * NotificationPopover — tabbed notification feed rendered inside TopBar's Popover.
 *
 * Features:
 * - Source tabs (All / Jira / GitLab) with unread count badges
 * - Unread-only filter toggle
 * - Time-grouped sections (Today / Yesterday / Earlier)
 * - Open-in-browser action on hover
 * - Mark-all-read header + per-item mark-as-read on hover
 * - Source-specific empty states
 * - Virtualized list via @tanstack/react-virtual for large notification feeds
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Bell, BellOff, GitMerge, TicketCheck } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import type { NotificationItem } from '../../stores/notifications.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationRow from './NotificationRow';

type SourceFilter = 'all' | 'jira' | 'gitlab';

/**
 * Extracts a Jira issue key from a notification item.
 */
function extractJiraIssueKey(item: {
  source: string;
  entityTitle: string;
  url?: string;
}): string | null {
  if (item.source !== 'jira') return null;
  const colonIdx = item.entityTitle.indexOf(':');
  if (colonIdx > 0) {
    const candidate = item.entityTitle.slice(0, colonIdx).trim();
    if (/^[A-Z]+-\d+$/.test(candidate)) return candidate;
  }
  if (item.url) {
    const match = item.url.match(/\/browse\/([A-Z]+-\d+)/);
    if (match) return match[1];
  }
  return null;
}

interface NotificationPopoverProps {
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
  onClose?: () => void;
}

function sortNewestFirst(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

const tabs: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'jira', label: 'Jira' },
  { key: 'gitlab', label: 'GitLab' },
];

/** Classify a timestamp into a day group. */
function getTimeGroup(isoTimestamp: string): 'today' | 'yesterday' | 'earlier' {
  const now = new Date();
  const then = new Date(isoTimestamp);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  if (then >= todayStart) return 'today';
  if (then >= yesterdayStart) return 'yesterday';
  return 'earlier';
}

const groupLabels: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
};

/** A virtual row is either a group header or a notification item. */
type VirtualEntry =
  | { type: 'header'; key: string; label: string }
  | { type: 'item'; item: NotificationItem };

/** Build a flat list of virtual entries (headers + items) from grouped notifications. */
function buildVirtualEntries(rowItems: NotificationItem[]): VirtualEntry[] {
  const entries: VirtualEntry[] = [];
  let currentGroup: string | null = null;

  for (const item of rowItems) {
    const group = getTimeGroup(item.createdAt);
    if (group !== currentGroup) {
      currentGroup = group;
      entries.push({ type: 'header', key: group, label: groupLabels[group] });
    }
    entries.push({ type: 'item', item });
  }

  return entries;
}

/** Virtualized notification list with group headers and measureElement for variable heights. */
function VirtualizedNotificationList({
  entries,
  readSet,
  onRowClick,
  onMarkRead,
  onDismiss,
  onOpenInBrowser,
}: {
  entries: VirtualEntry[];
  readSet: Set<string>;
  onRowClick: (item: NotificationItem) => void;
  onMarkRead: (item: NotificationItem) => void;
  onDismiss: (item: NotificationItem) => void;
  onOpenInBrowser: (item: NotificationItem) => (() => void) | undefined;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const useVirtual = virtualItems.length > 0;

  return (
    <div ref={parentRef} className="overflow-y-auto max-h-[520px]">
      <div
        style={
          useVirtual
            ? { height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }
            : undefined
        }
      >
        {useVirtual
          ? virtualItems.map((virtualRow) => {
              const entry = entries[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {entry.type === 'header' ? (
                    <div className="bg-background/95 backdrop-blur-sm px-3 py-1.5 border-b">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {entry.label}
                      </span>
                    </div>
                  ) : (
                    <NotificationRow
                      item={entry.item}
                      isUnread={!readSet.has(entry.item.id)}
                      onClick={() => onRowClick(entry.item)}
                      onMarkRead={() => onMarkRead(entry.item)}
                      onDismiss={() => onDismiss(entry.item)}
                      onOpenInBrowser={onOpenInBrowser(entry.item)}
                    />
                  )}
                </div>
              );
            })
          : entries.map((entry) =>
              entry.type === 'header' ? (
                <div key={entry.key} className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1.5 border-b">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {entry.label}
                  </span>
                </div>
              ) : (
                <NotificationRow
                  key={entry.item.id}
                  item={entry.item}
                  isUnread={!readSet.has(entry.item.id)}
                  onClick={() => onRowClick(entry.item)}
                  onMarkRead={() => onMarkRead(entry.item)}
                  onDismiss={() => onDismiss(entry.item)}
                  onOpenInBrowser={onOpenInBrowser(entry.item)}
                />
              ),
            )}
      </div>
    </div>
  );
}

export default function NotificationPopover({
  onIssueClick,
  onMRClick,
  onClose,
}: NotificationPopoverProps) {
  const [activeTab, setActiveTab] = useState<SourceFilter>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const {
    items,
    readIds,
    permissionDenied,
    notificationSendError,
    fetchError,
    retryFetch,
    markAllRead,
    markAllReadBySource,
    markAsRead,
    markAsUnread,
    removeItem,
    setPermissionDenied,
    setNotificationSendError,
  } = useNotificationsStore();

  const readSet = new Set(readIds);

  // Filter by active tab
  const tabFiltered = activeTab === 'all' ? items : items.filter((i) => i.source === activeTab);

  // Optionally filter to unread only
  const visibleItems = sortNewestFirst(
    unreadOnly ? tabFiltered.filter((i) => !readSet.has(i.id)) : tabFiltered,
  );

  // Unread counts per tab for badges
  const jiraUnread = items.filter((i) => i.source === 'jira' && !readSet.has(i.id)).length;
  const gitlabUnread = items.filter((i) => i.source === 'gitlab' && !readSet.has(i.id)).length;
  const totalUnread = jiraUnread + gitlabUnread;

  function getTabCount(key: SourceFilter): number {
    if (key === 'jira') return jiraUnread;
    if (key === 'gitlab') return gitlabUnread;
    return totalUnread;
  }

  function handleMarkAllRead() {
    if (activeTab === 'all') {
      markAllRead();
    } else {
      markAllReadBySource(activeTab);
    }
  }

  /** Click row = mark as read + navigate to detail. */
  function handleRowClick(item: NotificationItem) {
    markAsRead(item.id);
    // Navigate to issue or MR detail
    const issueKey = extractJiraIssueKey(item);
    if (issueKey && onIssueClick) {
      onIssueClick(issueKey);
      onClose?.();
      return;
    }
    if (item.source === 'gitlab' && item.mrProjectId && item.mrIid && onMRClick) {
      onMRClick(`${item.mrProjectId}/${item.mrIid}`);
      onClose?.();
      return;
    }
    // No navigable target — just mark read (row stays in popover)
  }

  function handleMarkRead(item: NotificationItem) {
    readSet.has(item.id) ? markAsUnread(item.id) : markAsRead(item.id);
  }

  function handleDismiss(item: NotificationItem) {
    removeItem(item.id);
  }

  function getOpenInBrowser(item: NotificationItem): (() => void) | undefined {
    return item.url
      ? () => {
          openUrl(item.url!).catch(() => {});
          markAsRead(item.id);
        }
      : undefined;
  }

  // Build flat virtual entries from grouped visible items
  const virtualEntries = useMemo(() => buildVirtualEntries(visibleItems), [visibleItems]);

  function renderEmptyState() {
    if (unreadOnly) {
      return (
        <EmptyState
          icon={BellOff}
          title="All caught up"
          subtitle={
            activeTab === 'all'
              ? 'No unread notifications'
              : `No unread ${activeTab === 'jira' ? 'Jira' : 'GitLab'} notifications`
          }
        />
      );
    }
    if (activeTab === 'jira') {
      return (
        <EmptyState
          icon={TicketCheck}
          title="No Jira notifications"
          subtitle="Comments, mentions, and issue updates from Jira will appear here"
        />
      );
    }
    if (activeTab === 'gitlab') {
      return (
        <EmptyState
          icon={GitMerge}
          title="No GitLab notifications"
          subtitle="MR comments, approvals, and pipeline alerts will appear here"
        />
      );
    }
    return (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        subtitle="Mentions and updates from Jira and GitLab will appear here"
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
        <span className="font-semibold text-sm">Notifications</span>
        <div className="flex items-center gap-1">
          {/* Unread-only toggle */}
          <Button
            variant={unreadOnly ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className="text-xs h-7 px-2"
            title={unreadOnly ? 'Show all' : 'Show unread only'}
          >
            {unreadOnly ? (
              <>
                <BellOff className="w-3.5 h-3.5 mr-1" />
                Unread
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5 mr-1" />
                All
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-xs h-7 px-2"
          >
            Mark all read
          </Button>
        </div>
      </div>

      {/* Source tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => {
          const count = getTabCount(tab.key);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                isActive
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full text-[10px] px-1 ${
                    tab.key === 'jira'
                      ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                      : tab.key === 'gitlab'
                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                  }`}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Permission-denied banner */}
      {permissionDenied && (
        <div className="m-2">
          <Alert>
            <AlertDescription>
              Desktop notifications are blocked. Enable them in System Settings → Notifications →
              Taskflow.
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

      {/* Feed */}
      {fetchError && visibleItems.length === 0 && retryFetch ? (
        <div className="overflow-y-auto max-h-[520px]">
          <div className="p-2">
            <ErrorState error={fetchError} onRetry={retryFetch} viewName="notifications" />
          </div>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="overflow-y-auto max-h-[520px]">
          {renderEmptyState()}
        </div>
      ) : (
        <VirtualizedNotificationList
          entries={virtualEntries}
          readSet={readSet}
          onRowClick={handleRowClick}
          onMarkRead={handleMarkRead}
          onDismiss={handleDismiss}
          onOpenInBrowser={getOpenInBrowser}
        />
      )}
    </div>
  );
}
