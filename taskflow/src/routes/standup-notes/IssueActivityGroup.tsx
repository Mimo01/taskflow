/**
 * IssueActivityGroup — single issue group in the Yesterday column.
 *
 * Renders the D-07 group header (issue type icon + key + summary + hours)
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
import { formatDuration } from '@/services/jira/duration';

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
}

export interface IssueActivityGroupProps {
  issueKey: string;
  summary: string;
  /** Jira issue type name — drives the type icon (Story, Bug, Sub-task, Epic, …). */
  issueType?: string;
  /** Total seconds logged via Tempo — displayed right-aligned when > 0 */
  totalSeconds: number;
  subItems: SubItem[];
  /** Click handler for the header — navigates to the issue detail page. */
  onClick?: () => void;
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
  }
}

export default function IssueActivityGroup({
  issueKey,
  summary,
  issueType,
  totalSeconds,
  subItems,
  onClick,
}: IssueActivityGroupProps) {
  return (
    <div className="py-2">
      {/* Group header: [icon] [key] [summary]          [Xh] — opens issue detail */}
      <button
        type="button"
        onClick={onClick}
        className="-mx-1 flex w-full cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-left text-sm font-semibold hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IssueTypeIcon typeName={issueType ?? ''} className="size-4 shrink-0" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{issueKey}</span>
        <span className="flex-1 min-w-0 truncate">{summary}</span>
        {totalSeconds > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground ml-auto">
            {formatDuration(totalSeconds)}
          </span>
        )}
      </button>

      {/* Sub-items */}
      {subItems.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1 pl-8">
          {subItems.map((item, i) => {
            const SubIcon = subItemIcon(item.kind);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
              <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                <SubIcon className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
                <span className="min-w-0">{item.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
