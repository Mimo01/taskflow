/**
 * WatchedPersonPicker — subtle standup-header dropdown to view a teammate's standup.
 *
 * Defaults to the logged-in user ("Me"). Selecting another Jira person threads an
 * effective identity through the page's query keys (see effectiveIdentity.ts) so the
 * whole standup re-derives for them. Selection is transient — owned by parent React
 * state, reset on every mount.
 *
 * The popover body is the shared PersonPickerPanel (server-side debounced search, avatar
 * rows) with a leading "Me" option. Uses the Popover primitive (not the Menu) because the
 * popover hosts a text input — a Menu would hijack typeahead/keyboard from the search field.
 */

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { PersonPickerPanel, toPersonValue } from '@/components/ui/person-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { JiraAssignableUser } from '@/services/jira/types';

interface WatchedPersonPickerProps {
  /** Currently watched user, or null when showing "Me". */
  value: JiraAssignableUser | null;
  /** Logged-in user's display name — shown for the "Me" row + default trigger label. */
  meDisplayName: string;
  /** Logged-in user's Jira avatar URL — rendered in the "Me" row. Null shows initials fallback. */
  meAvatarUrl: string | null;
  jiraBaseUrl: string;
  /** Active Jira project key (string key, not numeric id). */
  projectKey: string | null;
  /** null = revert to me; a user = watch that person. */
  onSelect: (user: JiraAssignableUser | null) => void;
}

export default function WatchedPersonPicker({
  value,
  meDisplayName,
  meAvatarUrl,
  jiraBaseUrl,
  projectKey,
  onSelect,
}: WatchedPersonPickerProps) {
  const [open, setOpen] = useState(false);

  const triggerLabel = value?.displayName ?? meDisplayName;

  function handleSelect(user: JiraAssignableUser | null) {
    onSelect(user);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Showing: ${triggerLabel}`}
        className="group/watched flex min-w-0 items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground"
      >
        <span className="hidden @[34rem]:inline">Showing:</span>
        <span className="max-w-28 truncate @[34rem]:max-w-48">{triggerLabel}</span>
        {/* Visible (not hover-only) so the space it takes reads as the dropdown affordance. */}
        <ChevronDown className="-ml-0.5 size-3 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <PersonPickerPanel
          open={open}
          projectKey={projectKey ?? undefined}
          jiraBaseUrl={jiraBaseUrl}
          value={value ? toPersonValue(value) : null}
          // "Me" reverts to the logged-in user's standup.
          extraOptions={[
            {
              id: 'me',
              label: `Me (${meDisplayName})`,
              avatar: (
                <CachedAvatar
                  url={meAvatarUrl}
                  name={meDisplayName}
                  size={20}
                  className="shrink-0"
                />
              ),
            },
          ]}
          selectedOptionId={value === null ? 'me' : undefined}
          onSelectOption={() => handleSelect(null)}
          onChange={(u) => u && handleSelect(u)}
          placeholder="Search people…"
        />
      </PopoverContent>
    </Popover>
  );
}
