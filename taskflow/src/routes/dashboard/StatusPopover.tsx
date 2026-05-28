/**
 * StatusPopover — Inline popover for Jira issue status transitions.
 *
 * Phase 72 (Plan 02): reads transitions from the GreenHopper project-scoped
 * cache via `useGhTransitions(projectId, issueTypeId)` instead of the per-issue
 * REST `/transitions` endpoint. The cache is project-scoped so multiple cards
 * of the same project share a single underlying envelope fetch.
 *
 * Calls onSelect(transitionId, toStatusName) when user picks a transition.
 * disabled prop prevents opening while a mutation is in-flight.
 *
 * Supports status-category coloring (new/indeterminate/done) to stay
 * consistent with TaskCard, StoryHeaderRow, and the issue-detail sidebar.
 */

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { filterTransitionsForStatus, useGhTransitions } from '@/services/jira';

interface StatusPopoverProps {
  /** Numeric Jira project id (Phase 72 — drives GH transitions cache key). */
  projectId: number;
  /** Jira issuetype id (Phase 72 — drives per-type transitions adaptation). */
  issueTypeId: string;
  /**
   * Current status id — used to filter the workflow's transition list down to
   * only those available from this status. Required because the GH envelope
   * returns all-status transitions; unlike the legacy per-issue REST endpoint.
   */
  currentStatusId: string;
  currentStatus: string;
  onSelect: (transitionId: string, toStatusName: string) => void;
  disabled?: boolean;
  statusCategoryKey?: string;
}

export default function StatusPopover({
  projectId,
  issueTypeId,
  currentStatusId,
  currentStatus,
  onSelect,
  disabled = false,
  statusCategoryKey,
}: StatusPopoverProps) {
  const [open, setOpen] = useState(false);

  const { data: allTransitions, isLoading, isError } = useGhTransitions(projectId, issueTypeId);
  const transitions = allTransitions
    ? filterTransitionsForStatus(allTransitions, currentStatusId)
    : undefined;

  function handleOpenChange(newOpen: boolean) {
    if (disabled) return;
    setOpen(newOpen);
  }

  function handleSelect(transitionId: string, toStatusName: string) {
    onSelect(transitionId, toStatusName);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={currentStatus}
        className={cn(
          statusPillClass(statusCategoryKey),
          'cursor-pointer hover:opacity-80 transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60',
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
              <span className={statusPillClass(transition.to.statusCategory?.key)}>
                {transition.name}
              </span>
            </button>
          ))}
      </PopoverContent>
    </Popover>
  );
}
