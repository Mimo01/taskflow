/**
 * StandaloneMrGroup — MR group for MR events not linked to any Jira issue (D-09).
 *
 * Heading: !{iid} {title}
 * Sub-items: "{n} comments on !{iid}" (collapsed count, D-05) and/or
 * "Approved !{iid}" — approvals stay discrete, comments are aggregated.
 */

import { CheckCircle, GitMerge, MessageSquare } from 'lucide-react';

interface StandaloneMrGroupProps {
  iid: number;
  title: string;
  commentCount: number;
  approvals: number;
}

export default function StandaloneMrGroup({
  iid,
  title,
  commentCount,
  approvals,
}: StandaloneMrGroupProps) {
  return (
    <div className="py-2">
      {/* Group header: !{iid} {title} */}
      <div className="flex items-center gap-2 py-2 px-2">
        <GitMerge className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono shrink-0">!{iid}</span>
        <span className="flex-1 min-w-0 truncate text-sm">{title}</span>
      </div>

      {/* Sub-items: collapsed comment count + approval (D-05) */}
      {(commentCount > 0 || approvals > 0) && (
        <div className="pl-6 border-l border-border ml-2 divide-y divide-border">
          {commentCount > 0 && (
            <div className="flex items-center gap-2 py-2 px-2">
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                {commentCount} comment{commentCount === 1 ? '' : 's'} on !{iid}
              </span>
            </div>
          )}
          {approvals > 0 && (
            <div className="flex items-center gap-2 py-2 px-2">
              <CheckCircle className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                Approved !{iid}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
