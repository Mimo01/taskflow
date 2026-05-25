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
}

export interface IssueActivityGroupProps {
  issueKey: string;
  summary: string;
  /** Jira issue type name — drives the type icon (Story, Bug, Sub-task, Epic, …). */
  issueType?: string;
  subItems: SubItem[];
  /** Click handler for the header — navigates to the issue detail page. */
  onClick?: () => void;
  /** Click handler for MR sub-items — navigates to MR detail page. */
  onMRClick?: (projectIdAndIid: string) => void;
  /** Click handler for issue sub-items (e.g. subtask worklogs) — navigates to that issue. */
  onIssueClick?: (key: string) => void;
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

export default function IssueActivityGroup({
  issueKey,
  summary,
  issueType,
  subItems,
  onClick,
  onMRClick,
  onIssueClick,
}: IssueActivityGroupProps) {
  return (
    <div>
      {/* Group header: [icon] [key] [summary] — opens issue detail */}
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IssueTypeIcon typeName={issueType ?? ''} className="size-4 shrink-0" />
        <span className="shrink-0 text-xs text-muted-foreground font-mono">{issueKey}</span>
        <span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
      </button>

      {/* Sub-items */}
      {subItems.length > 0 && (
        <div className="pl-6 ml-2">
          {subItems.map((item, i) => {
            const SubIcon = subItemIcon(item.kind);
            const isClickableMr =
              onMRClick != null && item.mrProjectId != null && item.mrIid != null;
            const isClickableIssue =
              onIssueClick != null && item.issueKey != null;
            return isClickableMr ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
              <button
                key={i}
                type="button"
                className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                onClick={() => onMRClick(`${item.mrProjectId}/${item.mrIid}`)}
              >
                <SubIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                  {item.label}
                </span>
              </button>
            ) : isClickableIssue ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
              <button
                key={i}
                type="button"
                className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                onClick={() => onIssueClick!(item.issueKey!)}
              >
                <SubIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                  {item.label}
                </span>
              </button>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
              <div key={i} className="flex items-center gap-2 py-1.5 px-2">
                <SubIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
