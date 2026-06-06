/**
 * TaskCard — Compact Jira issue card for the Sprint Board view.
 *
 * Shows issue key + type name (top row), summary (2-line clamp),
 * and a bottom row with assignee avatar (left), story points badge and
 * status badge (right). Matches Jira's familiar card layout.
 *
 * Extended props (HIER-02):
 * - subtaskCount: when > 0, renders a Badge chip and chevron toggle button
 * - isExpanded: controls chevron direction (down vs right)
 * - onToggle: called when chevron is clicked (stopPropagation included)
 * - isSubtask: retained for backward-compat typing; no longer alters the card
 *   border (all cards share the uniform issue-type left border)
 *
 * Context menu props (r56):
 * - transitions: pre-fetched JiraTransition[] from SprintBoardTab cache
 * - onTransition: callback when a transition menu item is clicked
 * - transitionError: error message shown below the card on failed transition
 * When onTransition is not provided, no context menu is rendered (safe for non-board contexts).
 *
 * PEEK-01/PEEK-05 (Phase 77 Plan 04 — D-10):
 * - When onOpenIssue is provided, outer wrapper becomes div[role=button] (body → peek)
 *   and the issue key renders as an inner <button> (key → full-page, stopPropagation).
 * - When only onClick is provided (backward-compat), outer stays a <button> with a plain
 *   key <span> (no nested buttons).
 */
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, Flag } from 'lucide-react';
import type React from 'react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { formatTimeAgo, formatTimeAgoStrict } from '@/lib/formatTimeAgo';
import { isDoneStatus, issueTypeStripeClass } from '@/lib/issueDisplayUtils';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue, JiraTransition } from '@/services/jira';

interface TaskCardProps {
  issue: JiraIssue;
  subtaskCount?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  isSubtask?: boolean;
  showStatus?: boolean;
  /** @deprecated Use onOpenIssue + onIssueClick for the PEEK-01/05 key/body split. Kept for backward-compat callers. */
  onClick?: () => void;
  /**
   * Phase 77 Plan 04 (PEEK-01/PEEK-05): clicking the card body opens the peek panel.
   * When provided, the outer wrapper becomes a div[role=button] so the inner key
   * button is valid HTML (no nested buttons — D-10 / Pitfall 1).
   */
  onOpenIssue?: (key: string) => void;
  /**
   * Phase 77 Plan 04 (PEEK-05): clicking the issue key navigates full-page.
   * stopPropagation prevents the body onOpenIssue from also firing.
   */
  onIssueClick?: (key: string) => void;
  /** Pre-fetched transitions for the context menu (sprint board only) */
  transitions?: JiraTransition[];
  /** Called when user selects a transition from the context menu */
  onTransition?: (
    transitionId: string,
    toStatusName: string,
    toStatusId: string,
    toStatusCategoryKey?: string,
  ) => void;
  /** Error message shown below the card after a failed transition */
  transitionError?: string;
  /** Whether this issue is currently flagged as an impediment */
  isFlagged?: boolean;
  /** Called when user selects Flag/Unflag from the context menu */
  onToggleFlag?: () => void;
  /**
   * Phase 73 (Plan 02) — time-in-column data from the GH allData adapter.
   * When present, renders a small muted badge alongside the story-points chip
   * showing how long the issue has been in its current status (UI-SPEC §1 / D-05).
   * Separate prop (not on `issue`) preserves backward-compat for non-board callers.
   */
  timeInColumn?: { enteredStatus: number; durationPreviously?: number };
  /**
   * Phase 79 (D-04): when true, the card registers a dnd-kit draggable.
   * Only non-story cards (subtasks/tasks) receive this prop — story header
   * rows are NOT draggable.
   */
  isDraggable?: boolean;
  /**
   * Phase 79 (D-12): ref set true for 50ms after a drag drop to suppress the
   * onClick (prevents stray peek-open after releasing a drag). Mirrors
   * BacklogRow.tsx:justDragged.
   */
  justDragged?: React.MutableRefObject<boolean>;
  /**
   * Phase 79: when true, renders the card as the DragOverlay ghost — no active
   * drag handle (useDraggable disabled), and aria-hidden="true" on the outer
   * element (UI-SPEC accessibility note).
   */
  isOverlay?: boolean;
}

// ── Shared card body content (layout is identical in both render paths) ────────

interface CardBodyProps {
  issue: JiraIssue;
  assignee: JiraIssue['fields']['assignee'];
  avatarUrl: string | undefined;
  displayName: string;
  issueTypeName: string | undefined;
  storyPoints: number | null | undefined;
  showStatus?: boolean;
  isFlagged?: boolean;
  subtaskCount?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  timeInColumn?: { enteredStatus: number; durationPreviously?: number };
  /** When true, the key renders as a <button> with stopPropagation (PEEK-05 path). */
  useKeyButton?: boolean;
  onIssueClick?: (key: string) => void;
}

function CardBody({
  issue,
  assignee,
  avatarUrl,
  displayName,
  issueTypeName,
  storyPoints,
  showStatus,
  isFlagged,
  subtaskCount,
  isExpanded,
  onToggle,
  timeInColumn,
  useKeyButton,
  onIssueClick,
}: CardBodyProps) {
  return (
    <>
      {/* Top row: flag icon (when flagged) + issue key (left) + issue type name (right) */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1">
          {isFlagged && <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />}
          {useKeyButton ? (
            /* PEEK-05: key button — stopPropagation prevents outer body onOpenIssue */
            <button
              type="button"
              className={cn(
                'text-xs font-mono text-muted-foreground cursor-pointer',
                isDoneStatus(issue.fields.status.statusCategory)
                  ? 'line-through hover:[text-decoration-line:underline_line-through]'
                  : 'hover:underline',
              )}
              onClick={(e) => {
                e.stopPropagation();
                onIssueClick?.(issue.key);
              }}
            >
              {issue.key}
            </button>
          ) : (
            /* Legacy path: plain span inside <button> outer */
            <span
              className={cn(
                'text-xs font-mono text-muted-foreground',
                isDoneStatus(issue.fields.status.statusCategory)
                  ? 'line-through group-hover:[text-decoration-line:underline_line-through]'
                  : 'group-hover:underline',
              )}
            >
              {issue.key}
            </span>
          )}
        </span>
        {issueTypeName && (
          <span className="text-[11px] text-muted-foreground/60 truncate max-w-[50%] text-right">
            {issueTypeName}
          </span>
        )}
      </div>

      {/* Summary — max 2 lines */}
      <div
        className="text-sm leading-snug overflow-hidden"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {issue.fields.summary}
      </div>

      {/* Bottom row: assignee avatar + name (left) + story points + status badge (right) */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {assignee && (
            <>
              <CachedAvatar url={avatarUrl} name={displayName} size={20} />
              <span className="text-[11px] text-muted-foreground/80 truncate">{displayName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Priority icon — actual Jira priority.iconUrl image (R2).
              PriorityIcon guards null/empty iconUrl (renders nothing). */}
          <PriorityIcon
            priority={
              issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined
            }
          />

          {/* Story points badge */}
          {storyPoints != null && storyPoints > 0 && (
            <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono leading-none">
              {storyPoints}
            </span>
          )}

          {/* Phase 73 Plan 02 — timeInColumn badge (UI-SPEC §1 / D-05 / R-03).
              Decorative metadata only; native `title` provides the tooltip
              (no Radix Tooltip per D-05a). Suppressed silently when absent. */}
          {timeInColumn?.enteredStatus != null && (
            <span
              className="text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono leading-none"
              title={`Entered status ${formatTimeAgo(timeInColumn.enteredStatus)} ago`}
            >
              {formatTimeAgoStrict(timeInColumn.enteredStatus)}
            </span>
          )}

          {/* Status badge — shown when not in a column context */}
          {showStatus && (
            <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
              {issue.fields.status.name}
            </span>
          )}
        </div>
      </div>

      {/* Subtask count chip + chevron — only when subtaskCount > 0 */}
      {subtaskCount != null && subtaskCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="flex items-center gap-1 p-1 -mx-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          <Badge variant="secondary" className="text-xs py-0 pointer-events-none">
            {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
          </Badge>
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      )}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskCard({
  issue,
  subtaskCount,
  isExpanded,
  onToggle,
  showStatus,
  onClick,
  onOpenIssue,
  onIssueClick,
  transitions,
  onTransition,
  transitionError,
  isFlagged,
  onToggleFlag,
  timeInColumn,
  isDraggable,
  justDragged,
  isOverlay,
}: TaskCardProps) {
  const assignee = issue.fields.assignee;
  const avatarUrl = assignee?.avatarUrls['48x48'];
  const displayName = assignee?.displayName ?? '';
  const issueTypeName = issue.fields.issuetype?.name;
  const storyPoints = issue.fields.customfield_10016 as number | null | undefined;

  // Phase 79 (D-04/D-12/D-13): dnd-kit draggable registration.
  // Disabled when isDraggable is false (story headers) or when rendering as the
  // DragOverlay ghost (isOverlay) — the ghost must not register a new draggable.
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragNodeRef,
    transform: dragTransform,
    isDragging,
  } = useDraggable({
    id: issue.key,
    disabled: !isDraggable || !!isOverlay,
  });

  // Build drag style only when the card is draggable. touch-action:none is
  // required for dnd-kit PointerSensor on touch devices and Tauri WebView2
  // (D-13). opacity:0 hides the in-place ghost so it doesn't double with the
  // portaled DragOverlay clone.
  const dragStyle: React.CSSProperties = isDraggable
    ? {
        transform: CSS.Transform.toString(dragTransform),
        opacity: isDragging && !isOverlay ? 0 : undefined,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }
    : {};

  // PEEK-01/PEEK-05 (D-10 / Pitfall 1): when onOpenIssue is wired, outer becomes
  // div[role=button] so the inner key <button> is valid HTML.
  const useKeyBodySplit = !!onOpenIssue;

  const sharedBodyProps: CardBodyProps = {
    issue,
    assignee,
    avatarUrl,
    displayName,
    issueTypeName,
    storyPoints,
    showStatus,
    isFlagged,
    subtaskCount,
    isExpanded,
    onToggle,
    timeInColumn,
    useKeyButton: useKeyBodySplit,
    onIssueClick,
  };

  const outerClassName = cn(
    'group border rounded-lg px-2 py-2 density-compact:py-1 density-comfortable:py-3 bg-card w-full flex flex-col gap-1 cursor-pointer hover:bg-accent/50 transition-colors text-left',
    'border-l-2',
    issueTypeStripeClass(issue.fields.issuetype),
    isFlagged &&
      'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40',
  );

  // dnd-kit's dragAttributes carries role/tabIndex/aria-* for accessibility.
  // On the div[role=button] path we already declare role + tabIndex explicitly
  // (required for the nested-button HTML validity invariant, D-10). Spread
  // dragAttributes FIRST so explicit props win; TypeScript's duplicate-attr
  // rule fires on JSX literals, so we extract what we need rather than
  // double-declaring.
  const {
    role: _dropRole,
    tabIndex: _dropTabIndex,
    ...restDragAttributes
  } = isDraggable ? dragAttributes : ({} as typeof dragAttributes);

  const outerElement = useKeyBodySplit ? (
    // biome-ignore lint/a11y/useSemanticElements: div[role=button] required — inner key is a <button>, nested <button> inside <button> is invalid HTML (D-10 / Pitfall 1)
    <div
      role="button"
      tabIndex={0}
      ref={isDraggable ? setDragNodeRef : undefined}
      style={dragStyle}
      data-dragging={isDragging ? 'true' : undefined}
      aria-hidden={isOverlay ? 'true' : undefined}
      className={outerClassName}
      onClick={() => {
        if (justDragged?.current) return; // D-12: guard — suppress peek after drop
        onOpenIssue(issue.key);
      }}
      onKeyDown={(e) => {
        // Only act on the card wrapper itself — Enter/Space on the inner key
        // <button> synthesizes a click there but the keydown still bubbles here;
        // without this guard it would ALSO fire the body peek.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (justDragged?.current) return;
          onOpenIssue(issue.key);
        }
      }}
      {...restDragAttributes}
      {...(isDraggable ? dragListeners : {})}
    >
      <CardBody {...sharedBodyProps} />
    </div>
  ) : (
    <button
      type="button"
      ref={isDraggable ? setDragNodeRef : undefined}
      style={dragStyle}
      data-dragging={isDragging ? 'true' : undefined}
      aria-hidden={isOverlay ? 'true' : undefined}
      className={outerClassName}
      onClick={() => {
        if (justDragged?.current) return; // D-12: guard
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.();
      }}
      {...(isDraggable ? dragAttributes : {})}
      {...(isDraggable ? dragListeners : {})}
    >
      <CardBody {...sharedBodyProps} />
    </button>
  );

  const cardContent = (
    <>
      {outerElement}
      {/* Transition error — shown below card on failed transitions */}
      {transitionError && <p className="text-xs text-destructive px-1">{transitionError}</p>}
    </>
  );

  // Wrap in ContextMenu when onTransition or onToggleFlag is provided
  if (!onTransition && !onToggleFlag) {
    return cardContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{cardContent}</ContextMenuTrigger>
      <ContextMenuContent>
        {onTransition && (
          <>
            <ContextMenuGroup>
              <ContextMenuLabel>Move to...</ContextMenuLabel>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            {transitions && transitions.length > 0 ? (
              transitions.map((transition) => (
                <ContextMenuItem
                  key={transition.id}
                  onClick={() =>
                    onTransition(
                      transition.id,
                      transition.to.name,
                      transition.to.id,
                      transition.to.statusCategory?.key,
                    )
                  }
                >
                  <span className="text-muted-foreground">→</span>
                  <span className={statusPillClass(transition.to.statusCategory?.key)}>
                    {transition.name}
                  </span>
                </ContextMenuItem>
              ))
            ) : (
              <ContextMenuGroup>
                <ContextMenuLabel className="text-muted-foreground italic">
                  No transitions available
                </ContextMenuLabel>
              </ContextMenuGroup>
            )}
          </>
        )}
        {onToggleFlag && (
          <>
            {onTransition && <ContextMenuSeparator />}
            <ContextMenuGroup>
              <ContextMenuLabel>Flag</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={onToggleFlag}>
                <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300" />
                {isFlagged ? 'Unflag' : 'Flag'}
              </ContextMenuItem>
            </ContextMenuGroup>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
