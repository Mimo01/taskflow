/**
 * PeekPanel — CSS squeeze/push layout panel mounted at AppLayout level.
 *
 * Renders as a flex-row sibling of <main> (NOT a Dialog/Sheet/portal).
 * Contains the full IssueDetailView in single-column layout (D-05/D-06), whose shared header
 * carries the issue actions; PeekPanel only supplies the trailing Open full page + Close
 * controls via `headerTrailing`. Width is persisted via the settings store and resizable
 * from the left edge (direction: 'left').
 *
 * D-01/D-08: No backdrop, no aria-hidden on underlying content, no role=dialog.
 * PEEK-06: Escape guarded against palette open state (Pitfall 6 / A3).
 * D-13: onOpenIssue is wired from the parent as setPeekIssueKey, enabling swap-in-peek.
 *
 * The header lives inside IssueDetailView (so it also renders while loading / unavailable),
 * which keeps Close reachable in every state.
 */

import { ExternalLink, X } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/components/ui/button';
import { useResizable } from '@/hooks/useResizable';
import type { EditInitialValues } from '@/routes/dashboard/CreateEditIssueModal';
import { IssueDetailView } from '@/routes/dashboard/IssueDetailView';

export interface PeekPanelProps {
  issueKey: string;
  width: number | null;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  onOpenIssue: (key: string) => void;
  onNavigateFull: (key: string) => void;
  paletteOpen: boolean;
  onEdit?: (vals: EditInitialValues) => void;
  onClone?: (vals: EditInitialValues) => void;
  onAddSubtask?: (parentKey: string) => void;
  onAddEpicStory?: (epicKey: string) => void;
}

export function PeekPanel({
  issueKey,
  width,
  onWidthChange,
  onClose,
  onOpenIssue,
  onNavigateFull,
  paletteOpen,
  onEdit,
  onClone,
  onAddSubtask,
  onAddEpicStory,
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

  // Escape dismisses peek — but NOT while the command palette is open (Pitfall 6 / A3) and
  // NOT while focus is inside a form element (input, textarea, select). Setting
  // enableOnFormTags: false ensures that Escape inside a comment composer or inline
  // edit field is handled locally by that control first, rather than closing the panel
  // and discarding in-progress text.
  useHotkeys('escape', onClose, {
    enableOnFormTags: false,
    enabled: !!issueKey && !paletteOpen,
  });

  return (
    <div
      data-find-scope="peek"
      className={`relative border-l border-border bg-card overflow-hidden flex flex-col shrink-0 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.25)] ring-1 ring-foreground/10${isDragging ? '' : ' transition-all duration-200'}`}
      style={{ width: panelWidth }}
    >
      {/* Left-edge drag handle (direction: 'left' — dragging left increases width) */}
      <div
        aria-hidden="true"
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-border/60 active:bg-border"
      />

      {/* Body: full IssueDetailView in single-column mode (D-05/D-06) */}
      {/* onOpenIssue is setPeekIssueKey from main.tsx — clicks inside peek swap, not navigate (D-13) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <IssueDetailView
          issueKey={issueKey}
          headerTrailing={
            <>
              <Button
                variant="outline"
                size="sm"
                aria-label="Open full page"
                title="Open full page"
                onClick={() => onNavigateFull(issueKey)}
                className="gap-1.5 whitespace-nowrap text-xs"
              >
                <ExternalLink className="size-3.5" />
                Open full page
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Close preview" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </>
          }
          layout="single-column"
          onOpenIssue={onOpenIssue}
          onEdit={onEdit}
          onClone={onClone}
          onAddSubtask={onAddSubtask}
          onAddEpicStory={onAddEpicStory}
        />
      </div>
    </div>
  );
}
