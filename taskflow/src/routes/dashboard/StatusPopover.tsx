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

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import {
  fetchIssueTransitionsWithFields,
  filterTransitionsForStatus,
  transitionsWithFieldsKey,
  useGhTransitions,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { BoardResolutionDialog } from './BoardResolutionDialog';

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
  onSelect: (
    transitionId: string,
    toStatusName: string,
    opts?: { resolution: { id: string } | null },
  ) => void;
  disabled?: boolean;
  statusCategoryKey?: string;
  /**
   * Issue key + base URL — when provided, the popover fetches this issue's REST
   * transitions WITH field metadata so it can detect resolution-capable transitions
   * and present a resolution picker dialog. The GH cache carries no field metadata, so
   * this is the only source of `fields.resolution.allowedValues`. Optional: board/drag
   * callers that don't pass these keep the plain transition behavior.
   */
  issueKey?: string;
  jiraBaseUrl?: string;
}

export default function StatusPopover({
  projectId,
  issueTypeId,
  currentStatusId,
  currentStatus,
  onSelect,
  disabled = false,
  statusCategoryKey,
  issueKey,
  jiraBaseUrl,
}: StatusPopoverProps) {
  const [open, setOpen] = useState(false);
  // When set, the popover closes and the resolution dialog opens. This avoids
  // the Positioner/Popup stretching to full viewport width (inline w-full buttons
  // resolve against the body as the containing block when the Positioner has no
  // explicit width set by floating-ui).
  const [pendingResolutionTransition, setPendingResolutionTransition] = useState<{
    id: string;
    toName: string;
    allowedValues: Array<{ id: string; name: string }>;
  } | null>(null);
  // WR-05: set when a transition declares resolution as required but exposes no
  // allowedValues (mis-configured workflow / partial field expansion). Firing
  // the plain transition would be rejected by Jira (400), so we keep the popover
  // open and surface an explicit message instead.
  const [resolutionUnavailable, setResolutionUnavailable] = useState(false);

  // WR-03: projectId=0 / empty issueTypeId means the issue search payload
  // was missing the `project` or `issuetype.id` fields. The hook is gated
  // off in that case, so explicitly surface a "missing project context"
  // affordance instead of an indefinite loading spinner.
  const hasContext = projectId > 0 && !!issueTypeId;
  const { data: allTransitions, isLoading, isError } = useGhTransitions(projectId, issueTypeId);
  const transitions = allTransitions
    ? filterTransitionsForStatus(allTransitions, currentStatusId)
    : undefined;

  // On-demand REST transitions-with-fields (shared cache key with FieldsSection's
  // sidebar control). Only enabled when the popover is open and we have an issue key.
  const { data: transitionsWithFields } = useQuery({
    // Shared factory with FieldsSection — keyed on the current status id so the
    // cache can't be reused across statuses (CR-01 / WR-04). The query is gated
    // on issueKey/jiraBaseUrl presence below, so the `?? ''` fallbacks never run.
    queryKey: transitionsWithFieldsKey(issueKey ?? '', jiraBaseUrl ?? '', currentStatusId),
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !issueKey || !jiraBaseUrl) return [];
      return fetchIssueTransitionsWithFields(jiraBaseUrl, token, issueKey);
    },
    enabled: open && !!issueKey && !!jiraBaseUrl,
    staleTime: Infinity,
  });

  function handleOpenChange(newOpen: boolean) {
    if (disabled) return;
    setOpen(newOpen);
    if (!newOpen) {
      setResolutionUnavailable(false);
    }
  }

  function handleSelect(transitionId: string, toStatusName: string) {
    // If the matching REST transition is resolution-capable, close the popover
    // and open the BoardResolutionDialog instead. Using a proper Dialog avoids
    // the inline Positioner/Popup stretching to full viewport width. If the REST
    // fetch is still loading / errored / empty, fall back to the plain transition.
    const meta = transitionsWithFields?.find((t) => t.id === transitionId);
    const allowedValues = meta?.fields?.resolution?.allowedValues;
    if (allowedValues && allowedValues.length > 0) {
      setResolutionUnavailable(false);
      setOpen(false);
      setPendingResolutionTransition({ id: transitionId, toName: toStatusName, allowedValues });
      return;
    }
    // WR-05: resolution is required but no allowedValues were returned. Firing
    // the plain transition is guaranteed to 400, so keep the popover open and
    // show an explicit message rather than sending a doomed request.
    if (meta?.fields?.resolution?.required) {
      setResolutionUnavailable(true);
      return;
    }
    onSelect(transitionId, toStatusName);
    setOpen(false);
  }

  function handleResolutionConfirm(resolution: { id: string } | null) {
    if (!pendingResolutionTransition) return;
    onSelect(pendingResolutionTransition.id, pendingResolutionTransition.toName, { resolution });
    setPendingResolutionTransition(null);
  }

  return (
    <>
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
          {resolutionUnavailable && (
            <div className="px-3 py-2 text-sm text-destructive">
              This transition requires a resolution, but none are available. Resolve the workflow
              configuration in Jira.
            </div>
          )}
          {!hasContext && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Missing project context — reload the board.
            </div>
          )}
          {hasContext && isLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
          )}
          {hasContext && isError && (
            <div className="px-3 py-2 text-sm text-destructive">Unable to load transitions</div>
          )}
          {!isLoading &&
            !isError &&
            transitions?.map((transition) => (
              <button
                key={transition.id}
                type="button"
                onClick={() => handleSelect(transition.id, transition.to.name)}
                className="w-full text-left px-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5 hover:bg-accent rounded flex items-center gap-2"
              >
                <span className="text-muted-foreground">→</span>
                <span className={statusPillClass(transition.to.statusCategory?.key)}>
                  {transition.name}
                </span>
              </button>
            ))}
        </PopoverContent>
      </Popover>

      {/* Resolution dialog — rendered outside the Popover tree so it uses a
          properly centered Dialog (sm:max-w-md) instead of the Positioner popup
          which stretches to full viewport width on issue-detail. Mirrors the
          board's BoardResolutionDialog UX exactly. Only active when issueKey is
          provided (issue-detail path); board/drag callers never set
          pendingResolutionTransition because they don't pass issueKey. */}
      {issueKey && (
        <BoardResolutionDialog
          key={issueKey}
          open={pendingResolutionTransition !== null}
          onOpenChange={(dialogOpen) => {
            if (!dialogOpen) setPendingResolutionTransition(null);
          }}
          issueKey={issueKey}
          toStatusName={pendingResolutionTransition?.toName ?? ''}
          allowedValues={pendingResolutionTransition?.allowedValues ?? []}
          onConfirm={handleResolutionConfirm}
        />
      )}
    </>
  );
}
