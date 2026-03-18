/**
 * TopBar — persistent top bar with search icon (opens palette), clock icon
 * (recent items popover), and two notification bell icons (Jira + GitLab).
 *
 * Pure UI component: renders badges from per-source unread counts, delegates all state to AppLayout.
 * Polling is performed by useNotificationPolling hook called from AppLayout in main.tsx
 * (requires QueryClientProvider — separated so TopBar tests work without a QueryClient wrapper).
 *
 * CRITICAL: TopBar must NOT use useQuery directly.
 */
import { Bell, Search } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { useJiraUnreadCount, useGitlabUnreadCount } from '../../stores/notifications.store';
import NotificationPopover from '../../routes/notifications/NotificationPopover';
import RecentItemsPopover from './RecentItemsPopover';

interface TopBarProps {
  /** Called with the Jira issue key when a Jira result in search or notifications is clicked. */
  onIssueClick?: (issueKey: string) => void;
  /** Called with "projectId/iid" when a GitLab MR is clicked from recent items. */
  onMRClick?: (projectIdAndIid: string) => void;
  /** Whether the command palette is currently open (reserved for future visual feedback). */
  paletteOpen: boolean;
  /** Callback to open the command palette. */
  onPaletteOpen: () => void;
  /** Controlled open state for the Jira notification popover. */
  jiraNotifOpen: boolean;
  /** Callback when Jira notification popover open state changes. */
  onJiraNotifChange: (open: boolean) => void;
  /** Controlled open state for the GitLab notification popover. */
  gitlabNotifOpen: boolean;
  /** Callback when GitLab notification popover open state changes. */
  onGitlabNotifChange: (open: boolean) => void;
}

export default function TopBar({ onIssueClick, onMRClick, onPaletteOpen, jiraNotifOpen, onJiraNotifChange, gitlabNotifOpen, onGitlabNotifChange }: TopBarProps) {
  const jiraUnreadCount = useJiraUnreadCount();
  const gitlabUnreadCount = useGitlabUnreadCount();

  return (
    <header className="h-12 border-b flex items-center px-4 flex-shrink-0 gap-2">
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

      {/* Jira notification popover — bell with orange indicator */}
      <Popover open={jiraNotifOpen} onOpenChange={onJiraNotifChange}>
        <PopoverTrigger
          className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
          aria-label="Jira notifications"
        >
          <Bell className="w-5 h-5" />
          {/* Orange source indicator */}
          <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full" />
          {jiraUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5">
              {jiraUnreadCount > 99 ? '99+' : jiraUnreadCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[28rem]">
          <NotificationPopover source="jira" onIssueClick={onIssueClick} onMRClick={onMRClick} onClose={() => onJiraNotifChange(false)} />
        </PopoverContent>
      </Popover>

      {/* GitLab notification popover — bell with purple indicator */}
      <Popover open={gitlabNotifOpen} onOpenChange={onGitlabNotifChange}>
        <PopoverTrigger
          className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
          aria-label="GitLab notifications"
        >
          <Bell className="w-5 h-5" />
          {/* Purple source indicator */}
          <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-purple-600 rounded-full" />
          {gitlabUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5">
              {gitlabUnreadCount > 99 ? '99+' : gitlabUnreadCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[28rem]">
          <NotificationPopover source="gitlab" onIssueClick={onIssueClick} onMRClick={onMRClick} onClose={() => onGitlabNotifChange(false)} />
        </PopoverContent>
      </Popover>
    </header>
  );
}
