/**
 * IssueActivityGroup — single issue group in the Yesterday column.
 *
 * Renders the D-07 group header (issue type icon + key + summary + hours)
 * and a sub-item list (commit, transition, MR comment, approval, Jira comment,
 * MR open) each with a Lucide icon per the UI-SPEC icon table.
 */

import {
  ArrowRight,
  Bug,
  ChevronRight,
  CheckCircle,
  CircleDot,
  GitBranch,
  GitMerge,
  Layers,
  MessageCircle,
  MessageSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type SubItemKind =
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
  /** Jira issue type: Story, Bug, Subtask, Epic, or anything else defaults to CircleDot */
  issueType?: string;
  /** Total seconds logged via Tempo — displayed right-aligned when > 0 */
  totalSeconds: number;
  subItems: SubItem[];
}

/** Map issue type string to the appropriate Lucide icon component. */
function issueTypeIcon(issueType: string | undefined) {
  switch (issueType?.toLowerCase()) {
    case 'bug':
      return Bug;
    case 'subtask':
      return ChevronRight;
    case 'epic':
      return Layers;
    default:
      return CircleDot;
  }
}

/** Map sub-item kind to Lucide icon component per UI-SPEC icon table. */
function subItemIcon(kind: SubItemKind) {
  switch (kind) {
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

function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function IssueActivityGroup({
  issueKey,
  summary,
  issueType,
  totalSeconds,
  subItems,
}: IssueActivityGroupProps) {
  const IssueIcon = issueTypeIcon(issueType);

  return (
    <div className="py-2">
      {/* Group header: [icon] [key] [summary]          [Xh] */}
      <div className="flex items-center gap-2 text-sm font-semibold">
        <IssueIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{issueKey}</span>
        <span className="flex-1 min-w-0 truncate">{summary}</span>
        {totalSeconds > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground ml-auto">
            {formatHours(totalSeconds)}
          </span>
        )}
        {issueType && (
          <Badge variant="outline" className="shrink-0 text-xs">
            {issueType}
          </Badge>
        )}
      </div>

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
