/**
 * PeekPanel — CSS squeeze/push layout panel mounted at AppLayout level.
 *
 * Renders as a flex-row sibling of <main> (NOT a Dialog/Sheet/portal).
 * Contains a header bar (issue type icon + key + title, Open full page, X close)
 * and the full IssueDetailView in single-column layout (D-05/D-06). Width is
 * persisted via the settings store and resizable from the left edge (direction: 'left').
 *
 * D-01/D-08: No backdrop, no aria-hidden on underlying content, no role=dialog.
 * PEEK-06: Escape guarded against palette open state (Pitfall 6 / A3).
 * D-13: onOpenIssue is wired from the parent as setPeekIssueKey, enabling swap-in-peek.
 *
 * Header is owned by PeekPanel (not IssueDetailView) so that Close (X) and Open full page
 * remain visible and functional during the loading state. The issue detail is deduped from
 * IssueDetailView via the same TanStack Query key ['jira-issue-detail', issueKey, jiraBaseUrl].
 * While the issue is loading, the header shows key + controls only. After load, it also shows
 * the issue-type icon and title (truncated).
 */

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, CornerLeftUp, ExternalLink, X } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/components/ui/button';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { useResizable } from '@/hooks/useResizable';
import { IssueDetailView } from '@/routes/dashboard/IssueDetailView';
import { fetchIssueDetail } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

export interface PeekPanelProps {
  issueKey: string;
  width: number | null;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  onOpenIssue: (key: string) => void;
  onNavigateFull: (key: string) => void;
  paletteOpen: boolean;
}

export function PeekPanel({
  issueKey,
  width,
  onWidthChange,
  onClose,
  onOpenIssue,
  onNavigateFull,
  paletteOpen,
}: PeekPanelProps) {
  const {
    width: panelWidth,
    isDragging,
    handleMouseDown,
  } = useResizable({
    initialWidth: width ?? 480,
    min: 360,
    max: 720,
    onCommit: onWidthChange,
    direction: 'left',
  });

  // Auth + settings — needed to match the IssueDetailView query key exactly so TanStack
  // Query dedupes this call against the one inside IssueDetailView (no duplicate fetch).
  const { jiraBaseUrl, jiraConnected } = useAuthStore();
  const {
    epicLinkFieldKey,
    epicNameFieldKey,
    sprintFieldKey,
    storyPointsFieldKey,
    epicColorFieldKey,
  } = useSettingsStore();

  // Deduped issue read — same query key as IssueDetailView.tsx:103-118.
  // The five field keys are NOT part of the key, matching IssueDetailView exactly.
  // staleTime and enabled guard also match to ensure identical cache behavior.
  const { data: issue } = useQuery({
    queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchIssueDetail(jiraBaseUrl, token, issueKey ?? '', {
        epicLinkFieldKey,
        epicNameFieldKey,
        sprintFieldKey,
        storyPointsFieldKey,
        epicColorFieldKey,
      });
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  });

  // Escape dismisses peek — but NOT while the command palette is open (Pitfall 6 / A3) and
  // NOT while focus is inside a form element (input, textarea, select). Setting
  // enableOnFormTags: false ensures that Escape inside a comment composer or inline
  // edit field is handled locally by that control first, rather than closing the panel
  // and discarding in-progress text.
  useHotkeys('escape', onClose, {
    enableOnFormTags: false,
    enabled: !!issueKey && !paletteOpen,
  });

  // Parent link in the header (subtasks only) — surfaces the parent in the peek
  // instead of the body section the full page uses. Narrowed to a const so the
  // onClick closure stays type-safe without a non-null assertion.
  const peekParent = issue?.fields.issuetype.subtask ? issue.fields.parent : undefined;

  return (
    <div
      className={`relative border-l border-border bg-card overflow-hidden flex flex-col shrink-0 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.25)] ring-1 ring-foreground/10${isDragging ? '' : ' transition-all duration-200'}`}
      style={{ width: panelWidth }}
    >
      {/* Left-edge drag handle (direction: 'left' — dragging left increases width) */}
      <div
        aria-hidden="true"
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-border/60 active:bg-border"
      />

      {/* Header bar — always visible, controls stay accessible during load.
          Left side: while issue is defined, shows icon + key + truncated title.
          While loading (issue undefined), shows key only.
          min-w-0 flex-1 on the left container allows the title to shrink/truncate
          without displacing the right-side controls (0-width flex pitfall guard). */}
      <div className="flex items-center justify-between h-10 px-4 border-b border-border shrink-0">
        {/* Left: parent breadcrumb (subtasks, after load) + icon + key + title (after load) */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {peekParent && (
            <>
              <button
                type="button"
                onClick={() => onOpenIssue(peekParent.key)}
                title={peekParent.fields.summary}
                aria-label={`Open parent issue ${peekParent.key}`}
                className="flex items-center gap-1 shrink-0 text-xs font-mono text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
              >
                <CornerLeftUp className="size-3.5" />
                {peekParent.key}
              </button>
              <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
            </>
          )}
          {issue && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
          {/* Key must NOT shrink — badge stays mono and always visible */}
          <span className="text-xs font-mono text-muted-foreground shrink-0">{issueKey}</span>
          {issue && (
            /* pr-0.5 guards the italic/overhang truncate-clip pitfall */
            <span className="text-sm font-medium truncate pr-0.5">{issue.fields.summary}</span>
          )}
        </div>

        {/* Right: Open full page + Close — shrink-0 so they're never squeezed off */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateFull(issueKey)}
            className="gap-1"
          >
            <ExternalLink className="size-3.5" />
            Open full page
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close preview" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Body: full IssueDetailView in single-column mode (D-05/D-06) */}
      {/* onOpenIssue is setPeekIssueKey from main.tsx — clicks inside peek swap, not navigate (D-13) */}
      <div className="flex-1 overflow-hidden">
        <IssueDetailView issueKey={issueKey} layout="single-column" onOpenIssue={onOpenIssue} />
      </div>
    </div>
  );
}
