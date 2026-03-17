/**
 * NotificationPopover — notification feed rendered inside TopBar's Popover.
 *
 * Pure UI component: reads from notifications store, renders feed, mark-all-read header,
 * and permission-denied Alert banner. Polling logic lives in TopBar (useQuery with
 * refetchInterval) where QueryClientProvider is always available.
 */
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationRow from './NotificationRow';
import NotificationDetail from './NotificationDetail';

/**
 * Extracts a Jira issue key from a notification item.
 * entityTitle is formatted as "PROJ-123: Fix login bug" for Jira items.
 * Falls back to extracting from the url path (/browse/PROJ-123) if entityTitle parsing fails.
 */
function extractJiraIssueKey(item: { source: string; entityTitle: string; url?: string }): string | null {
  if (item.source !== 'jira') return null;
  // entityTitle: "PROJ-123: Fix login bug" — key is everything before the first ": "
  const colonIdx = item.entityTitle.indexOf(':');
  if (colonIdx > 0) {
    const candidate = item.entityTitle.slice(0, colonIdx).trim();
    // Validate: Jira keys are ALPHA-NUMBER (e.g. PROJ-123)
    if (/^[A-Z]+-\d+$/.test(candidate)) return candidate;
  }
  // Fallback: extract from url /browse/PROJ-123
  if (item.url) {
    const match = item.url.match(/\/browse\/([A-Z]+-\d+)/);
    if (match) return match[1];
  }
  return null;
}

interface NotificationPopoverProps {
  /** Called with the Jira issue key when a Jira notification row is clicked. When provided,
   *  Jira notifications open the IssueDetailSheet instead of the inline NotificationDetail. */
  onIssueClick?: (issueKey: string) => void;
  /** Called with "projectId/iid" when a GitLab MR notification is clicked. */
  onMRClick?: (projectIdAndIid: string) => void;
}

export default function NotificationPopover({ onIssueClick, onMRClick }: NotificationPopoverProps) {
  const {
    items,
    readIds,
    permissionDenied,
    fetchError,
    retryFetch,
    markAllRead,
    markAsRead,
    setPermissionDenied,
  } = useNotificationsStore();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const readSet = new Set(readIds);

  // Sort newest-first
  const sortedItems = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const selectedItem = selectedItemId
    ? items.find((i) => i.id === selectedItemId) ?? null
    : null;

  function handleRowClick(item: (typeof sortedItems)[0]) {
    const issueKey = extractJiraIssueKey(item);
    if (issueKey && onIssueClick) {
      // Open Jira issue in the issue detail page
      markAsRead(item.id);
      onIssueClick(issueKey);
      return;
    }
    // GitLab MR notifications — navigate to internal MR detail page
    if (item.source === 'gitlab' && item.mrProjectId && item.mrIid && onMRClick) {
      markAsRead(item.id);
      onMRClick(`${item.mrProjectId}/${item.mrIid}`);
      return;
    }
    // Fallback: show inline NotificationDetail
    setSelectedItemId(item.id);
    markAsRead(item.id);
  }

  function handleDetailClose() {
    setSelectedItemId(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <span className="font-semibold text-sm">Notifications</span>
        <Button variant="ghost" size="sm" onClick={markAllRead}>
          Mark all as read
        </Button>
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
        {fetchError && items.length === 0 && retryFetch ? (
          <div className="p-2">
            <ErrorState error={fetchError} onRetry={retryFetch} viewName="notifications" />
          </div>
        ) : sortedItems.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" subtitle="Mentions and updates will appear here as they happen" />
        ) : (
          sortedItems.map((item) => (
            <div key={item.id}>
              <NotificationRow
                item={item}
                isUnread={!readSet.has(item.id)}
                onClick={() => handleRowClick(item)}
              />
              {selectedItemId === item.id && selectedItem && (
                <NotificationDetail item={selectedItem} onClose={handleDetailClose} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
