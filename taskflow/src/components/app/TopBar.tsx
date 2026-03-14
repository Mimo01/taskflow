/**
 * TopBar — persistent top bar with search icon, bell icon, unread badge, and notification popover trigger.
 *
 * Pure UI component: renders badge from unread count, wraps bell in Popover trigger.
 * Polling is performed by useNotificationPolling hook called from AppLayout in main.tsx
 * (requires QueryClientProvider — separated so TopBar tests work without a QueryClient wrapper).
 *
 * Search: useState(searchOpen) only — SearchOverlay child handles all search logic including useQuery.
 * CRITICAL: TopBar must NOT use useQuery directly.
 *
 * Rendered as first child of the flex-col div inside AppLayout (after onboarding check).
 * Bell badge shows unread count capped at 99+. Zero = badge hidden.
 */
import { useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { useUnreadCount } from '../../stores/notifications.store';
import NotificationPopover from '../../routes/notifications/NotificationPopover';
import SearchOverlay from './SearchOverlay';

interface TopBarProps {
  /** Called with the Jira issue key when a Jira result in search or notifications is clicked. */
  onIssueClick?: (issueKey: string) => void;
}

export default function TopBar({ onIssueClick }: TopBarProps) {
  const unreadCount = useUnreadCount();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-12 border-b flex items-center justify-end px-4 flex-shrink-0 gap-2">
      {/* Search trigger */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Search"
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
      >
        <Search className="w-5 h-5" />
      </button>

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
          <NotificationPopover onIssueClick={onIssueClick} />
        </PopoverContent>
      </Popover>

      {/* Search overlay — rendered outside Popover so it can cover full screen */}
      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onIssueClick={onIssueClick}
        />
      )}
    </header>
  );
}
