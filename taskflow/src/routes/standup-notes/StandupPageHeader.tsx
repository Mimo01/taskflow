import { Calendar, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JiraAssignableUser } from '@/services/jira/types';
import WatchedPersonPicker from './WatchedPersonPicker';

interface StandupPageHeaderProps {
  /** Formatted date the standup is given on (today), e.g. "Monday, 26 May 2026" */
  dateLabel: string;
  /** Minutes since last successful data sync; null means never synced or unknown */
  syncedMinutesAgo: number | null;
  /** Called when the user clicks the Refresh button */
  onRefresh: () => void;
  /** Called when the user clicks the Copy markdown button */
  onCopyMarkdown: () => void;
  /** True for 2 seconds after a successful clipboard write */
  copied: boolean;
  /** True while a data refresh is in flight — spins the icon and disables the button */
  isRefreshing: boolean;
  /** Currently watched teammate, or null when showing the logged-in user. */
  watchedUser: JiraAssignableUser | null;
  /** Logged-in user's display name (default picker label + "Me" row). */
  meDisplayName: string;
  /** Logged-in user's Jira avatar URL — passed through to WatchedPersonPicker "Me" row. */
  meAvatarUrl: string | null;
  jiraBaseUrl: string;
  /** Active Jira project key for the assignable-user search. */
  projectKey: string | null;
  /** null = revert to me; a user = watch that person. */
  onSelectWatched: (user: JiraAssignableUser | null) => void;
}

/**
 * StandupPageHeader
 *
 * Full-width page header for the Standup Notes route.
 *
 * Left side: page title "Standup notes" + muted yesterday date.
 * Right side: sync status ("• synced Nm ago"), Refresh (ghost), Copy markdown (primary).
 *
 * Per UI-SPEC D-11:
 * - Title is lowercase "notes" — "Standup notes"
 * - Copy markdown button uses the Lucide Copy icon to the left of the label
 * - Accent (primary) is reserved for the Copy markdown button only
 */
export default function StandupPageHeader({
  dateLabel,
  syncedMinutesAgo,
  onRefresh,
  onCopyMarkdown,
  copied,
  isRefreshing,
  watchedUser,
  meDisplayName,
  meAvatarUrl,
  jiraBaseUrl,
  projectKey,
  onSelectWatched,
}: StandupPageHeaderProps) {
  return (
    <header className="px-6 py-4 border-b border-border flex items-center justify-between">
      {/* Left: title + date */}
      <div>
        <h1 className="text-3xl font-semibold">Standup notes</h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs leading-none text-muted-foreground">
          <Calendar className="size-3.5 shrink-0" />
          {dateLabel}
        </p>
      </div>

      {/* Right: watched-person picker + sync status + Refresh + Copy markdown */}
      <div className="flex items-center gap-2">
        <WatchedPersonPicker
          value={watchedUser}
          meDisplayName={meDisplayName}
          meAvatarUrl={meAvatarUrl}
          jiraBaseUrl={jiraBaseUrl}
          projectKey={projectKey}
          onSelect={onSelectWatched}
        />
        {syncedMinutesAgo !== null && (
          <span className="text-xs text-muted-foreground">• synced {syncedMinutesAgo}m ago</span>
        )}
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
        <Button variant="default" size="sm" onClick={onCopyMarkdown}>
          <Copy />
          {copied ? 'Copied!' : 'Copy markdown'}
        </Button>
      </div>
    </header>
  );
}
