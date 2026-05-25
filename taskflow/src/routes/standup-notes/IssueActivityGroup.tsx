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
  /** Present on mr-comment and approval sub-items — enables click-to-MR-detail. */
  mrProjectId?: number;
  mrIid?: number;
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
  /** Click handler for MR sub-items — navigates to MR detail page. */
  onMRClick?: (projectIdAndIid: string) => void;
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
  totalSeconds,
  subItems,
  onClick,
  onMRClick,
}: IssueActivityGroupProps) {
  return (
    <div className="py-2">
      {/* Group header: [icon] [key] [summary]          [Xh] — opens issue detail */}
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IssueTypeIcon typeName={issueType ?? ''} className="size-4 shrink-0" />
        <span className="shrink-0 text-xs text-muted-foreground font-mono">{issueKey}</span>
        <span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
        {totalSeconds > 0 && (
          <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            {formatDuration(totalSeconds)}
          </span>
        )}
      </button>

      {/* Sub-items */}
      {subItems.length > 0 && (
        <div className="pl-6 border-l border-border ml-2 divide-y divide-border">
          {subItems.map((item, i) => {
            const SubIcon = subItemIcon(item.kind);
            const isClickableMr =
              onMRClick != null && item.mrProjectId != null && item.mrIid != null;
            return isClickableMr ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
              <div
                key={i}
                role="button"
                tabIndex={0}
                className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                onClick={() => onMRClick(`${item.mrProjectId}/${item.mrIid}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    onMRClick(`${item.mrProjectId}/${item.mrIid}`);
                }}
              >
                <SubIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                  {item.label}
                </span>
              </div>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reorder
              <div key={i} className="flex items-center gap-2 py-2 px-2">
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
