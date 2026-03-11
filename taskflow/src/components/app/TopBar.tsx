/**
 * TopBar — persistent top bar with bell icon, unread badge, and notification popover trigger.
 *
 * Pure UI component: renders badge from unread count, wraps bell in Popover trigger.
 * Polling is performed by useNotificationPolling hook called from AppLayout in main.tsx
 * (requires QueryClientProvider — separated so TopBar tests work without a QueryClient wrapper).
 *
 * Rendered as first child of the flex-col div inside AppLayout (after onboarding check).
 * Bell badge shows unread count capped at 99+. Zero = badge hidden.
 */
import { Bell } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { useUnreadCount } from '../../stores/notifications.store';
import NotificationPopover from '../../routes/notifications/NotificationPopover';

export default function TopBar() {
  const unreadCount = useUnreadCount();

  return (
    <header className="h-12 border-b flex items-center justify-end px-4 flex-shrink-0">
      <Popover>
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
        <PopoverContent className="p-0 w-80">
          <NotificationPopover />
        </PopoverContent>
      </Popover>
    </header>
  );
}
