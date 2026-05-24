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
      <div className="flex items-center gap-2 text-sm font-semibold">
        <GitMerge className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 min-w-0 truncate">
          <span className="text-muted-foreground font-mono mr-1">!{iid}</span>
          {title}
        </span>
      </div>

      {/* Sub-items: collapsed comment count + approval (D-05) */}
      {(commentCount > 0 || approvals > 0) && (
        <ul className="mt-1 flex flex-col gap-1 pl-8">
          {commentCount > 0 && (
            <li className="flex items-start gap-1.5 text-xs text-foreground">
              <MessageSquare className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
              <span className="min-w-0">
                {commentCount} comment{commentCount === 1 ? '' : 's'} on !{iid}
              </span>
            </li>
          )}
          {approvals > 0 && (
            <li className="flex items-start gap-1.5 text-xs text-foreground">
              <CheckCircle className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
              <span className="min-w-0">Approved !{iid}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
