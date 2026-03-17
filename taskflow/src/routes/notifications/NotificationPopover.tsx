/**
 * NotificationPopover — notification feed rendered inside TopBar's Popover.
 *
 * Pure UI component: reads from notifications store, renders feed, mark-all-read header,
 * and permission-denied Alert banner. All notification clicks navigate directly to the
 * relevant detail page (Jira issue or GitLab MR) and close the popover.
 *
 * When both Jira and GitLab items are present, groups them under sticky section headers.
 */
import { Bell } from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import type { NotificationItem } from '../../stores/notifications.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import NotificationRow from './NotificationRow';

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

export default function NotificationPopover({ onIssueClick, onMRClick, onClose }: NotificationPopoverProps) {
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

  const readSet = new Set(readIds);

  // Group by source
  const jiraItems = sortNewestFirst(items.filter((i) => i.source === 'jira'));
  const gitlabItems = sortNewestFirst(items.filter((i) => i.source === 'gitlab'));
  const hasBothSources = jiraItems.length > 0 && gitlabItems.length > 0;

  // When only one source, just sort all newest-first
  const singleSourceItems = !hasBothSources ? sortNewestFirst(items) : [];

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
    // No matching callback — just mark as read
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
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" subtitle="Mentions and updates will appear here as they happen" />
        ) : hasBothSources ? (
          <>
            {/* Jira section */}
            <div className="sticky top-0 z-10 bg-background border-b px-3 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jira</span>
            </div>
            {renderRows(jiraItems)}

            {/* GitLab section */}
            <div className="sticky top-0 z-10 bg-background border-b px-3 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GitLab</span>
            </div>
            {renderRows(gitlabItems)}
          </>
        ) : (
          renderRows(singleSourceItems)
        )}
      </div>
    </div>
  );
}
