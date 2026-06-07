/**
 * WatchedPersonPicker — subtle standup-header dropdown to view a teammate's standup.
 *
 * Defaults to the logged-in user ("Me"). Selecting another Jira person threads an
 * effective identity through the page's query keys (see effectiveIdentity.ts) so the
 * whole standup re-derives for them. Selection is transient — owned by parent React
 * state, reset on every mount.
 *
 * Pattern: copies the MentionPopover server-side search query (debounced term in the
 * queryKey, token read INSIDE the queryFn per T-62-06, no client-side .filter() —
 * Pitfall 2: fetchAssignableUsers does server-side `&username=` filtering). Uses the
 * Popover primitive (not the Menu) because the popover hosts a text input — a Menu
 * would hijack typeahead/keyboard from the search field.
 */

import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { JiraAssignableUser } from '@/services/jira/types';
import { fetchAssignableUsers } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';

interface WatchedPersonPickerProps {
  /** Currently watched user, or null when showing "Me". */
  value: JiraAssignableUser | null;
  /** Logged-in user's display name — shown for the "Me" row + default trigger label. */
  meDisplayName: string;
  jiraBaseUrl: string;
  /** Active Jira project key (string key, not numeric id). */
  projectKey: string | null;
  /** null = revert to me; a user = watch that person. */
  onSelect: (user: JiraAssignableUser | null) => void;
}

export default function WatchedPersonPicker({
  value,
  meDisplayName,
  jiraBaseUrl,
  projectKey,
  onSelect,
}: WatchedPersonPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search term by 200ms (copied from MentionPopover).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset the search field whenever the popover closes so reopening starts clean.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  const { data: users = [], isLoading } = useQuery({
    // T-62-06: token NEVER in the key. Debounced term IS in the key (server-side filter).
    queryKey: ['standup', 'watched-user-search', jiraBaseUrl, projectKey, debouncedQuery],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return [];
      // Pitfall 2: server-side `&username=` filtering — no client-side .filter().
      return fetchAssignableUsers(jiraBaseUrl, token, projectKey ?? '', debouncedQuery);
    },
    enabled: open && !!jiraBaseUrl && !!projectKey,
    staleTime: 5 * 60_000,
  });

  const triggerLabel = value?.displayName ?? meDisplayName;

  function handleSelect(user: JiraAssignableUser | null) {
    onSelect(user);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="group/watched flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
        <span>Showing: {triggerLabel}</span>
        <ChevronDown className="size-3.5 opacity-0 transition-opacity group-hover/watched:opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="h-8 text-sm mb-1"
        />
        <div className="max-h-60 overflow-y-auto">
          {/* "Me" row — reverts to the logged-in user's standup. */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`flex w-full items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left hover:bg-accent/50 ${
              value === null ? 'bg-accent/40' : ''
            }`}
          >
            <CachedAvatar url={null} name={meDisplayName} size={20} className="shrink-0" />
            <span className="truncate">Me ({meDisplayName})</span>
          </button>

          {isLoading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading users…</div>
          )}
          {!isLoading && debouncedQuery !== '' && users.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No matching users</div>
          )}
          {users.map((user) => {
            const avatarUrl =
              user.avatarUrls?.['48x48'] ??
              user.avatarUrls?.['24x24'] ??
              user.avatarUrls?.['16x16'];
            // Jira `key` (account key) is the stable identifier; fall back to
            // `name` only when absent. Avoids collisions on non-unique usernames.
            const userId = user.key ?? user.name;
            const selectedId = value ? (value.key ?? value.name) : null;
            return (
              <button
                key={userId}
                type="button"
                onClick={() => handleSelect(user)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left hover:bg-accent/50 ${
                  selectedId === userId ? 'bg-accent/40' : ''
                }`}
              >
                <CachedAvatar
                  url={avatarUrl}
                  name={user.displayName}
                  size={20}
                  className="shrink-0"
                />
                <span className="truncate">{user.displayName}</span>
                <span className="text-muted-foreground text-xs ml-auto truncate">{user.name}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
