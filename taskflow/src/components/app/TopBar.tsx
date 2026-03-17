/**
 * TopBar — persistent top bar with search icon (opens palette), clock icon
 * (recent items popover), and bell icon (controlled notification popover).
 *
 * Pure UI component: renders badge from unread count, delegates all state to AppLayout.
 * Polling is performed by useNotificationPolling hook called from AppLayout in main.tsx
 * (requires QueryClientProvider — separated so TopBar tests work without a QueryClient wrapper).
 *
 * CRITICAL: TopBar must NOT use useQuery directly.
 */
import { Bell, Search } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { useUnreadCount } from '../../stores/notifications.store';
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
  /** Controlled open state for the notification popover. */
  notifPopoverOpen: boolean;
  /** Callback when notification popover open state changes. */
  onNotifPopoverChange: (open: boolean) => void;
}

export default function TopBar({ onIssueClick, onMRClick, onPaletteOpen, notifPopoverOpen, onNotifPopoverChange }: TopBarProps) {
  const unreadCount = useUnreadCount();

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

      {/* Notification popover — controlled from AppLayout for Cmd+Shift+N */}
      <Popover open={notifPopoverOpen} onOpenChange={onNotifPopoverChange}>
        <PopoverTrigger
          className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[28rem]">
          <NotificationPopover onIssueClick={onIssueClick} onMRClick={onMRClick} onClose={() => onNotifPopoverChange(false)} />
        </PopoverContent>
      </Popover>
    </header>
  );
}
