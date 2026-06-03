/**
 * PeekPanel — CSS squeeze/push layout panel mounted at AppLayout level.
 *
 * Renders as a flex-row sibling of <main> (NOT a Dialog/Sheet/portal).
 * Contains a header bar (issue key, Open full page, X close) and the full
 * IssueDetailView in single-column layout (D-05/D-06). Width is persisted via
 * the settings store and resizable from the left edge (direction: 'left').
 *
 * D-01/D-08: No backdrop, no aria-hidden on underlying content, no role=dialog.
 * PEEK-06: Escape guarded against palette open state (Pitfall 6 / A3).
 * D-13: onOpenIssue is wired from the parent as setPeekIssueKey, enabling swap-in-peek.
 */

import { ExternalLink, X } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/components/ui/button';
import { useResizable } from '@/hooks/useResizable';
import { IssueDetailView } from '@/routes/dashboard/IssueDetailView';

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
      className={`relative border-l border-border bg-card overflow-hidden flex flex-col shrink-0${isDragging ? '' : ' transition-all duration-200'}`}
      style={{ width: panelWidth }}
    >
      {/* Left-edge drag handle (direction: 'left' — dragging left increases width) */}
      <div
        aria-hidden="true"
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-border/60 active:bg-border"
      />

      {/* Header bar */}
      <div className="flex items-center justify-between h-10 px-4 border-b border-border shrink-0">
        {/* Left: issue key */}
        <span className="text-xs font-mono text-muted-foreground">{issueKey}</span>

        {/* Right: Open full page + Close */}
        <div className="flex items-center gap-1">
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
