/**
 * IssueActivityGroup — single issue group in the Yesterday column.
 *
 * Renders the D-07 group header (issue type icon + key + summary)
 * and a sub-item list (commit, transition, MR comment, approval, Jira comment,
 * MR open) each with a Lucide icon per the UI-SPEC icon table.
 */

import {
  ArrowRight,
  CheckCircle,
  Clock,
  GitBranch,
  GitMerge,
  MessageCircle,
  MessageSquare,
} from 'lucide-react';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { statusPillClass } from '@/lib/statusStyles';

export type SubItemKind =
  | 'worklog'
  | 'commit'
  | 'transition'
  | 'mr-comment'
  | 'approval'
  | 'jira-comment'
  | 'mr-open';

export interface SubItem {
  kind: SubItemKind;
  label: string;
  /** Present on mr-comment and approval sub-items — enables click-to-MR-detail. */
  mrProjectId?: number;
  mrIid?: number;
  /** Present on worklog sub-items for subtasks — enables click-to-issue-detail. */
  issueKey?: string;
  /** The originating issue key for this activity (set at attach time in buildGroups).
   *  Distinct from issueKey (click affordance) — used for the sub-task partition pass. */
  originKey?: string;
  /** Structured transition data for 'transition' sub-items, used to render two status
   *  pills + a muted arrow. `label` remains the plain-text markdown source (do NOT remove);
   *  this field drives the styled render only. Categories are statusCategory.key values
   *  (undefined → gray fallback inside statusPillClass). */
  transition?: {
    fromStatus: string;
    toStatus: string;
    fromCategory?: string;
    toCategory?: string;
  };
}

/** A sub-task sub-group: activity items attributable to one specific sub-task,
 *  displayed nested within the parent story's IssueActivityGroup. */
export interface SubTaskSubGroup {
  issueKey: string;
  summary: string;
  issueType?: string;
  subItems: SubItem[];
}

export interface IssueActivityGroupProps {
  issueKey: string;
  summary: string;
  /** Jira issue type name — drives the type icon (Story, Bug, Sub-task, Epic, …). */
  issueType?: string;
  subItems: SubItem[];
  /** Sub-task sub-groups to render nested below the story's own sub-item list. */
  subTaskGroups?: SubTaskSubGroup[];
  /** Click handler for the header body — opens the peek panel (PEEK-01). */
  onClick?: () => void;
  /** Click handler for the issue KEY element — navigates full-page (PEEK-05). */
  onIssueKeyClick?: () => void;
  /** Click handler for MR sub-items — navigates to MR detail page. */
  onMRClick?: (projectIdAndIid: string) => void;
  /** Click handler for issue sub-items (e.g. subtask worklogs) — navigates to that issue. */
  onIssueClick?: (key: string) => void;
  /** Click handler for sub-task header body — opens the peek panel for the sub-task.
   *  Falls back to onIssueClick when not provided. */
  onOpenIssue?: (key: string) => void;
}

/** Map sub-item kind to Lucide icon component per UI-SPEC icon table. */
function subItemIcon(kind: SubItemKind) {
  switch (kind) {
    case 'worklog':
      return Clock;
    case 'commit':
      return GitBranch;
    case 'transition':
      return ArrowRight;
    case 'mr-comment':
      return MessageSquare;
    case 'approval':
      return CheckCircle;
    case 'jira-comment':
      return MessageCircle;
    case 'mr-open':
      return GitMerge;
    default:
      return GitBranch;
  }
}

/** Renders a list of sub-items (worklogs, commits, MR events, etc.) with click affordances.
 *  Extracted to avoid duplicating the three-way clickable-MR / clickable-issue / plain
 *  branches in both the story-level and sub-task-level render paths. */
function SubItemList({
  items,
  onMRClick,
  onIssueClick,
}: {
  items: SubItem[];
  onMRClick?: (projectIdAndIid: string) => void;
  onIssueClick?: (key: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item, i) => {
        const SubIcon = subItemIcon(item.kind);
        const isClickableMr = onMRClick != null && item.mrProjectId != null && item.mrIid != null;
        const isClickableIssue = onIssueClick != null && item.issueKey != null;
        return isClickableMr ? (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
            key={i}
            type="button"
            className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            onClick={() => onMRClick(`${item.mrProjectId}/${item.mrIid}`)}
          >
            <SubIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 min-w-0 truncate text-sm text-foreground">{item.label}</span>
          </button>
        ) : isClickableIssue ? (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
            key={i}
            type="button"
            className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            onClick={() => onIssueClick?.(item.issueKey ?? '')}
          >
            <SubIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 min-w-0 truncate text-sm text-foreground">{item.label}</span>
          </button>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
          <div key={i} className="flex items-center gap-2 py-1.5 px-2">
            <SubIcon className="size-4 shrink-0 text-muted-foreground" />
            {item.kind === 'transition' && item.transition != null ? (
              // Styled transition: two status pills + muted arrow, mirroring StatusPopover.
              // statusPillClass owns all geometry; the flex wrapper provides the flex parent.
              <div className="flex flex-1 min-w-0 items-center gap-2">
                <span className={statusPillClass(item.transition.fromCategory)}>
                  {item.transition.fromStatus}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className={statusPillClass(item.transition.toCategory)}>
                  {item.transition.toStatus}
                </span>
              </div>
            ) : (
              <span className="flex-1 min-w-0 truncate text-sm text-foreground">{item.label}</span>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Clickable group/sub-task header: [icon] [key] [summary].
 *
 *  The whole row opens the peek panel (onBodyClick); the key navigates full-page
 *  (onKeyClick). To keep both affordances without an interactive element nested
 *  inside another interactive element (invalid HTML + ARIA violation), the
 *  full-row peek control is an absolutely-positioned overlay <button> that is a
 *  SIBLING of the key <button>, not its ancestor. Icon + summary are
 *  pointer-events-none so clicks fall through to the overlay; the key sits above
 *  it via relative z-10. Both buttons are independently focusable. */
function ActivityGroupHeader({
  issueKey,
  summary,
  issueType,
  onBodyClick,
  onKeyClick,
}: {
  issueKey: string;
  summary: string;
  issueType?: string;
  onBodyClick?: () => void;
  onKeyClick?: () => void;
}) {
  return (
    <div className="relative flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 focus-within:bg-muted/50">
      <button
        type="button"
        aria-label={`Open ${issueKey} ${summary}`}
        className="absolute inset-0 rounded cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onBodyClick}
      />
      <IssueTypeIcon
        typeName={issueType ?? ''}
        className="pointer-events-none relative size-4 shrink-0"
      />
      <button
        type="button"
        className="relative z-10 shrink-0 rounded text-xs text-muted-foreground font-mono cursor-pointer hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onKeyClick}
      >
        {issueKey}
      </button>
      <span className="pointer-events-none relative flex-1 min-w-0 truncate text-sm">
        {summary}
      </span>
    </div>
  );
}

export default function IssueActivityGroup({
  issueKey,
  summary,
  issueType,
  subItems,
  subTaskGroups,
  onClick,
  onIssueKeyClick,
  onMRClick,
  onIssueClick,
  onOpenIssue,
}: IssueActivityGroupProps) {
  return (
    <div>
      {/* Group header: body → peek (onClick), key → full-page (onIssueKeyClick) */}
      <ActivityGroupHeader
        issueKey={issueKey}
        summary={summary}
        issueType={issueType}
        onBodyClick={onClick}
        onKeyClick={onIssueKeyClick}
      />

      {/* Story-level sub-items (flat, directly under the story header) */}
      {subItems.length > 0 && (
        <div className="pl-6 ml-2">
          <SubItemList items={subItems} onMRClick={onMRClick} onIssueClick={onIssueClick} />
        </div>
      )}

      {/* Sub-task sub-groups: nested below story-level items, only when non-empty */}
      {subTaskGroups && subTaskGroups.length > 0 && (
        <div className="pl-6 ml-2">
          {subTaskGroups.map((st) => (
            <div key={st.issueKey}>
              {/* Sub-task header: body → peek, key → full-page */}
              <ActivityGroupHeader
                issueKey={st.issueKey}
                summary={st.summary}
                issueType={st.issueType}
                onBodyClick={() => (onOpenIssue ?? onIssueClick)?.(st.issueKey)}
                onKeyClick={() => onIssueClick?.(st.issueKey)}
              />
              {/* Sub-task's own activity items, indented a further level */}
              {st.subItems.length > 0 && (
                <div className="pl-6 ml-2">
                  <SubItemList
                    items={st.subItems}
                    onMRClick={onMRClick}
                    onIssueClick={onIssueClick}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
