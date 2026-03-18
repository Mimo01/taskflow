/**
 * NotificationPopover — tabbed notification feed rendered inside TopBar's Popover.
 *
 * Pure UI component: reads from notifications store, renders feed with tabs
 * (All / Jira / GitLab), mark-all-read header, and permission-denied Alert banner.
 * All notification clicks navigate directly to the relevant detail page and close the popover.
 */
import { useState } from 'react';
import { Bell } from 'lucide-react';
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
 * entityTitle is formatted as "PROJ-123: Fix login bug" for Jira items.
 * Falls back to extracting from the url path (/browse/PROJ-123) if entityTitle parsing fails.
 */
function extractJiraIssueKey(item: { source: string; entityTitle: string; url?: string }): string | null {
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
  /** Called with the Jira issue key when a Jira notification row is clicked. */
  onIssueClick?: (issueKey: string) => void;
  /** Called with "projectId/iid" when a GitLab MR notification is clicked. */
  onMRClick?: (projectIdAndIid: string) => void;
  /** Called to close the popover after a navigation click. */
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

export default function NotificationPopover({ onIssueClick, onMRClick, onClose }: NotificationPopoverProps) {
  const [activeTab, setActiveTab] = useState<SourceFilter>('all');
  const {
    items,
    readIds,
    permissionDenied,
    fetchError,
    retryFetch,
    markAllRead,
    markAllReadBySource,
    markAsRead,
    setPermissionDenied,
  } = useNotificationsStore();

  const readSet = new Set(readIds);

  // Filter by active tab and sort newest-first
  const filteredItems = sortNewestFirst(
    activeTab === 'all' ? items : items.filter((i) => i.source === activeTab),
  );

  // Unread counts per tab for badges
  const jiraUnread = items.filter((i) => i.source === 'jira' && !readSet.has(i.id)).length;
  const gitlabUnread = items.filter((i) => i.source === 'gitlab' && !readSet.has(i.id)).length;

  function getTabCount(key: SourceFilter): number {
    if (key === 'jira') return jiraUnread;
    if (key === 'gitlab') return gitlabUnread;
    return jiraUnread + gitlabUnread;
  }

  function handleMarkAllRead() {
    if (activeTab === 'all') {
      markAllRead();
    } else {
      markAllReadBySource(activeTab);
    }
  }

  function handleRowClick(item: NotificationItem) {
    const issueKey = extractJiraIssueKey(item);
    if (issueKey && onIssueClick) {
      markAsRead(item.id);
      onIssueClick(issueKey);
      onClose?.();
      return;
    }
    if (item.source === 'gitlab' && item.mrProjectId && item.mrIid && onMRClick) {
      markAsRead(item.id);
      onMRClick(`${item.mrProjectId}/${item.mrIid}`);
      onClose?.();
      return;
    }
    markAsRead(item.id);
  }

  function renderRows(rowItems: NotificationItem[]) {
    return rowItems.map((item) => (
      <NotificationRow
        key={item.id}
        item={item}
        isUnread={!readSet.has(item.id)}
        onClick={() => handleRowClick(item)}
      />
    ));
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
        <span className="font-semibold text-sm">Notifications</span>
        <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
          Mark all as read
        </Button>
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
                <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full text-[10px] px-1 ${
                  tab.key === 'jira'
                    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                    : tab.key === 'gitlab'
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                      : 'bg-red-500/15 text-red-600 dark:text-red-400'
                }`}>
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

      {/* Feed */}
      <div className="overflow-y-auto max-h-[520px]">
        {fetchError && filteredItems.length === 0 && retryFetch ? (
          <div className="p-2">
            <ErrorState error={fetchError} onRetry={retryFetch} viewName="notifications" />
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" subtitle="Mentions and updates will appear here as they happen" />
        ) : (
          renderRows(filteredItems)
        )}
      </div>
    </div>
  );
}
