/**
 * StatusPopover — Inline popover for Jira issue status transitions.
 *
 * Fetches available transitions lazily on first open (not on mount).
 * Calls onSelect(transitionId, toStatusName) when user picks a transition.
 * disabled prop prevents opening while a mutation is in-flight.
 *
 * Supports status-category coloring (new/indeterminate/done) to stay
 * consistent with TaskCard, StoryHeaderRow, and the issue-detail sidebar.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchTransitions } from '@/services/jira';
import { readSecret } from '@/services/stronghold';

interface StatusPopoverProps {
  issueKey: string;
  currentStatus: string;
  jiraBaseUrl: string;
  /** Pass token directly (e.g. TaskRow) or omit to resolve via readSecret */
  token?: string;
  onSelect: (transitionId: string, toStatusName: string) => void;
  disabled?: boolean;
  statusCategoryKey?: string;
}

export default function StatusPopover({
  issueKey,
  currentStatus,
  jiraBaseUrl,
  token,
  onSelect,
  disabled = false,
  statusCategoryKey,
}: StatusPopoverProps) {
  const [open, setOpen] = useState(false);

  const {
    data: transitions,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['transitions', issueKey],
    queryFn: async () => {
      const resolvedToken = token ?? (await readSecret('jira-pat').catch(() => null));
      if (!resolvedToken) return [];
      return fetchTransitions(jiraBaseUrl, resolvedToken, issueKey);
    },
    enabled: false, // Lazy — only fetch when popover opens
  });

  function handleOpenChange(newOpen: boolean) {
    if (disabled) return;
    setOpen(newOpen);
    if (newOpen) {
      refetch();
    }
  }

  function handleSelect(transitionId: string, toStatusName: string) {
    onSelect(transitionId, toStatusName);
    setOpen(false);
  }

  const categoryStyle = statusCategoryKey
    ? `${statusCategoryBadgeClass(statusCategoryKey)} border-transparent`
    : 'border-border text-foreground';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={currentStatus}
        className={cn(
          'cursor-pointer rounded-full border px-2 py-0.5 text-xs font-medium hover:opacity-80 transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60',
          categoryStyle,
        )}
      >
        {currentStatus}
      </PopoverTrigger>
      <PopoverContent className="p-1 min-w-[160px]">
        {isLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>}
        {isError && (
          <div className="px-3 py-2 text-sm text-destructive">Unable to load transitions</div>
        )}
        {!isLoading &&
          !isError &&
          transitions?.map((transition) => (
            <button
              key={transition.id}
              type="button"
              onClick={() => handleSelect(transition.id, transition.to.name)}
              className="w-full text-left px-2 py-1.5 hover:bg-accent rounded flex items-center gap-2"
            >
              <span className="text-muted-foreground">→</span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  statusCategoryBadgeClass(transition.to.statusCategory?.key),
                )}
              >
                {transition.name}
              </span>
            </button>
          ))}
      </PopoverContent>
    </Popover>
  );
}
