import { useQuery } from '@tanstack/react-query';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import type { JiraAssignableUser } from '@/services/jira/types';
import { fetchAssignableUsers } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';

export interface MentionPopoverHandle {
  handleKeyDown: (key: string) => void;
}

interface MentionPopoverProps {
  query: string;
  projectKey: string;
  jiraBaseUrl: string;
  position: { bottom: number; left: number };
  onSelect: (user: JiraAssignableUser) => void;
  onDismiss: () => void;
}

export const MentionPopover = forwardRef<MentionPopoverHandle, MentionPopoverProps>(
  function MentionPopover({ query, projectKey, jiraBaseUrl, position, onSelect, onDismiss }, ref) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [debouncedQuery, setDebouncedQuery] = useState(query);
    const containerRef = useRef<HTMLDivElement>(null);

    // Debounce query by 200ms
    useEffect(() => {
      const timer = setTimeout(() => setDebouncedQuery(query), 200);
      return () => clearTimeout(timer);
    }, [query]);

    // Reset active index when query changes
    // biome-ignore lint/correctness/useExhaustiveDependencies: debouncedQuery is the intentional trigger dep for this reset effect
    useEffect(() => {
      setActiveIndex(0);
    }, [debouncedQuery]);

    const { data: users = [], isLoading } = useQuery({
      queryKey: ['jira-assignable-users', projectKey, jiraBaseUrl, debouncedQuery],
      queryFn: async () => {
        const token = await readSecret('jira-pat').catch(() => null);
        if (!token) return [];
        return fetchAssignableUsers(jiraBaseUrl, token, projectKey, debouncedQuery);
      },
      staleTime: 5 * 60_000,
      enabled: !!jiraBaseUrl && !!projectKey,
    });

    // Click outside to dismiss
    useEffect(() => {
      function handleMouseDown(e: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onDismiss();
        }
      }
      document.addEventListener('mousedown', handleMouseDown);
      return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [onDismiss]);

    // Scroll active item into view
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const activeEl = container.querySelector(`[data-mention-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }, [activeIndex]);

    // Expose keyboard handler to parent
    useImperativeHandle(ref, () => ({
      handleKeyDown(key: string) {
        if (key === 'ArrowDown') {
          setActiveIndex((prev) => (prev < users.length - 1 ? prev + 1 : 0));
        } else if (key === 'ArrowUp') {
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : users.length - 1));
        } else if (key === 'Enter') {
          if (users[activeIndex]) {
            onSelect(users[activeIndex]);
          }
        }
      },
    }));

    const listboxId = 'mention-listbox';

    return (
      <div
        ref={containerRef}
        role="listbox"
        id={listboxId}
        className="absolute z-50 bg-popover border rounded-md shadow-lg p-1 min-w-[200px] max-h-[240px] overflow-y-auto"
        style={{ bottom: position.bottom, left: Math.max(0, position.left) }}
      >
        {isLoading && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading users...</div>
        )}
        {!isLoading && users.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No matching users</div>
        )}
        {users.map((user, index) => {
          const optionId = `mention-option-${index}`;
          const isActive = index === activeIndex;
          const avatarUrl =
            user.avatarUrls?.['48x48'] ?? user.avatarUrls?.['24x24'] ?? user.avatarUrls?.['16x16'];

          return (
            <div
              key={user.name}
              id={optionId}
              role="option"
              tabIndex={-1}
              aria-selected={isActive}
              data-mention-index={index}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-sm ${
                isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              }`}
              onClick={() => onSelect(user)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSelect(user); } }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <CachedAvatar
                url={avatarUrl}
                name={user.displayName}
                size={20}
                className="shrink-0"
              />
              <span className="truncate">{user.displayName}</span>
              <span className="text-muted-foreground text-xs ml-auto truncate">{user.name}</span>
            </div>
          );
        })}
      </div>
    );
  },
);
